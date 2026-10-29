import { effectiveSlot } from "./schedule";
import { addDays, durationHours, parseClock } from "./time";
import type { Employee, LaborNote, RotaState, Slot } from "./types";

/**
 * Hours of Work and Rest Law, 1951, as applied to a shift roster.
 * Seven consecutive worked days block placement.
 * The other duties are notes: they do not block placement.
 *
 * Weekly rest is 36 consecutive hours (section 7).
 * Eight hours between one work day and the next.
 * A work day is 8 hours, 7 on night work and on Friday for an employee who observes Shabbat (section 2).
 * The private-sector week is 42 ordinary hours.
 * The 2018 general overtime permit allows 12 hours in a day and 16 overtime hours in a week.
 * A night shift has at least two hours between 22:00 and 06:00. Eight or more night shifts in two weeks is a note.
 * The general permit, including the guarding permit, requires the weekly rest day at least once every four weeks.
 */
export const WEEKLY_REST_HOURS = 36;
export const BETWEEN_DAYS_HOURS = 8;
export const DAY_CAP_HOURS = 12;
export const OVERTIME_CAP_HOURS = 16;
export const ORDINARY_DAY_HOURS = 8;
export const SHORT_DAY_HOURS = 7;
export const ORDINARY_WEEK_HOURS = 42;
const NIGHT_MARK_HOURS = 2;
const NIGHT_SHIFTS_PER_FORTNIGHT = 7;

interface Work {
  start: number;
  end: number;
  iso: string;
}

export interface DayStreak {
  from: string;
  to: string;
  days: number;
}

function scheduleDates(state: RotaState, employeeId: string, week: string): string[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const dates: string[] = [];
  for (const [key, ids] of Object.entries(schedule.assign ?? {})) {
    if (!ids?.includes(employeeId)) continue;
    const pipe = key.indexOf("|");
    const day = Number(key.slice(0, pipe));
    if (pipe <= 0 || day < 0 || day > 6) continue;
    dates.push(addDays(week, day));
  }
  return dates;
}

function peerDates(state: RotaState, employeeId: string, week: string): string[] {
  if (state.week !== week) return [];
  return (state.peers?.[employeeId] ?? []).map((peer) => addDays(week, peer.weekOffset + peer.day));
}

/** Days with an assignment, including the week before and the week after, and other sites. */
export function workedDates(state: RotaState, employeeId: string, week: string, mine: Slot[] = [], extraDay?: number): Set<string> {
  const worked = new Set<string>();
  const current = state.week === week ? mine : [];
  if (current.length > 0 || extraDay !== undefined) {
    for (const slot of current) {
      if (slot.day >= 0 && slot.day <= 6) worked.add(addDays(week, slot.day));
    }
    if (extraDay !== undefined && extraDay >= 0 && extraDay <= 6) worked.add(addDays(week, extraDay));
    for (const offset of [-7, 7]) {
      for (const iso of scheduleDates(state, employeeId, addDays(week, offset))) worked.add(iso);
    }
  } else {
    for (const offset of [-7, 0, 7]) {
      for (const iso of scheduleDates(state, employeeId, addDays(week, offset))) worked.add(iso);
    }
  }
  for (const iso of peerDates(state, employeeId, week)) worked.add(iso);
  return worked;
}

/** Every 7-day window that contains `iso`. The run is the full stretch, when it is at least 7. */
export function consecutiveRun(worked: Set<string>, iso: string): DayStreak | null {
  for (let back = 0; back <= 6; back += 1) {
    const start = addDays(iso, -back);
    const full = [0, 1, 2, 3, 4, 5, 6].every((step) => worked.has(addDays(start, step)));
    if (!full) continue;
    let from = iso;
    while (worked.has(addDays(from, -1))) from = addDays(from, -1);
    let to = iso;
    while (worked.has(addDays(to, 1))) to = addDays(to, 1);
    let days = 0;
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) days += 1;
    return { from, to, days };
  }
  return null;
}

/** Maximal runs of 7 or more worked days that touch `week`. */
export function consecutiveStreaks(state: RotaState, employeeId: string, week: string): DayStreak[] {
  const worked = workedDates(state, employeeId, week);
  const weekEnd = addDays(week, 6);
  const streaks: DayStreak[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 7 && run[0] <= weekEnd && run[run.length - 1] >= week) {
      streaks.push({ from: run[0], to: run[run.length - 1], days: run.length });
    }
    run = [];
  };
  for (let iso = addDays(week, -21); iso <= addDays(week, 27); iso = addDays(iso, 1)) {
    if (worked.has(iso)) run.push(iso);
    else flush();
  }
  flush();
  return streaks;
}

function dot(iso: string): string {
  const [, month, date] = iso.split("-");
  return `${Number(date)}.${Number(month)}`;
}

function hourCount(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "0";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function weekday(iso: string): number {
  const [year, month, date] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay();
}

function overlap(start: number, end: number, from: number, to: number): number {
  return Math.max(0, Math.min(end, to) - Math.max(start, from));
}

function nightHours(start: number, end: number): number {
  let hours = 0;
  for (let day = -10; day <= 16; day += 1) {
    hours += overlap(start, end, day * 24 + 22, (day + 1) * 24 + 6);
  }
  return hours;
}

function assignedWork(state: RotaState, employeeId: string, week: string): Work[] {
  const items: Work[] = [];
  for (const offset of [-7, 0, 7]) {
    const weekKey = addDays(week, offset);
    const schedule = state.sched[weekKey];
    if (!schedule) continue;
    for (const [slotKey, ids] of Object.entries(schedule.assign ?? {})) {
      if (!ids?.includes(employeeId)) continue;
      const pipe = slotKey.indexOf("|");
      const day = Number(slotKey.slice(0, pipe));
      const shiftId = slotKey.slice(pipe + 1);
      if (pipe <= 0 || day < 0 || day > 6) continue;
      const shift = state.biz.shifts.find((item) => item.id === shiftId);
      if (!shift) continue;
      const start = day * 24 + parseClock(shift.start);
      const slot: Slot = {
        key: slotKey,
        day,
        shiftId,
        start,
        end: start + durationHours(shift.start, shift.end),
        required: 0,
      };
      const effective = effectiveSlot(schedule, slot, employeeId);
      items.push({
        start: effective.start + offset * 24,
        end: effective.end + offset * 24,
        iso: addDays(weekKey, day),
      });
    }
  }
  if (state.week === week) {
    for (const peer of state.peers?.[employeeId] ?? []) {
      items.push({ start: peer.start, end: peer.end, iso: addDays(week, peer.weekOffset + peer.day) });
    }
  }
  return items.filter((item) => item.end > item.start + 1e-9);
}

function merge(items: Work[]): { start: number; end: number }[] {
  const sorted = [...items].sort((left, right) => left.start - right.start);
  const spans: { start: number; end: number }[] = [];
  for (const item of sorted) {
    const last = spans[spans.length - 1];
    if (!last || item.start > last.end + 1e-9) spans.push({ start: item.start, end: item.end });
    else last.end = Math.max(last.end, item.end);
  }
  return spans;
}

function dayName(iso: string, lang: "he" | "en"): string {
  const names =
    lang === "he"
      ? ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
      : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return names[weekday(iso)] ?? "";
}

/** Notes for one week. Empty when the person has no work in the week. */
export function laborNotes(state: RotaState, week: string, lang: "he" | "en" = "he"): LaborNote[] {
  const notes: LaborNote[] = [];
  const weekEnd = addDays(week, 6);
  for (const employee of state.emps) {
    const work = assignedWork(state, employee.id, week);
    const inWeek = work.filter((item) => item.iso >= week && item.iso <= weekEnd);
    if (inWeek.length === 0) continue;
    notes.push(...restNotes(employee, work, lang));
    notes.push(...gapNotes(employee, work, lang));
    notes.push(...dayNotes(employee, inWeek, lang));
    notes.push(...overtimeNote(employee, inWeek, lang));
    notes.push(...nightNote(employee, work, week, lang));
    notes.push(...shabbatRunNote(state, employee, week, lang));
  }
  return notes;
}

function coversFullDay(gapStart: number, gapEnd: number): boolean {
  for (let day = 0; day < 7; day += 1) {
    if (gapStart <= day * 24 + 1e-9 && gapEnd >= (day + 1) * 24 - 1e-9) return true;
  }
  return false;
}

/** A rest counts for this week when it lasts 36 hours and meets the week, not when it only spills in from last week. */
function countsAsWeeklyRest(gapStart: number, gapEnd: number): boolean {
  if (gapEnd - gapStart < WEEKLY_REST_HOURS - 1e-9) return false;
  if (gapEnd <= 0 || gapStart >= 168) return false;
  const inside = Math.min(gapEnd, 168) - Math.max(gapStart, 0);
  if (inside >= WEEKLY_REST_HOURS - 1e-9) return true;
  return coversFullDay(gapStart, gapEnd);
}

function restNotes(employee: Employee, work: Work[], lang: "he" | "en"): LaborNote[] {
  const spans = merge(work);
  if (!spans.some((span) => span.end > 0 && span.start < 168)) return [];
  const gaps = [{ start: -168, end: spans[0].start }];
  for (let index = 0; index < spans.length - 1; index += 1) {
    gaps.push({ start: spans[index].end, end: spans[index + 1].start });
  }
  gaps.push({ start: spans[spans.length - 1].end, end: 336 });
  const described = gaps
    .map((gap, index) => {
      const inside = Math.min(gap.end, 168) - Math.max(gap.start, 0);
      const openEnded = index === 0 || index === gaps.length - 1;
      const shown = !openEnded || coversFullDay(gap.start, gap.end) || inside >= WEEKLY_REST_HOURS ? gap.end - gap.start : inside;
      return { gap, shown };
    })
    .filter((item) => item.gap.end > 1e-9 && item.gap.start < 168 - 1e-9 && item.shown > 0);
  if (described.some((item) => countsAsWeeklyRest(item.gap.start, item.gap.end))) return [];
  const longest = described.reduce((best, item) => Math.max(best, item.shown), 0);
  if (longest >= WEEKLY_REST_HOURS - 1e-9) return [];
  const hours = hourCount(longest);
  return [
    {
      key: `weekly-rest#${employee.id}`,
      employeeId: employee.id,
      code: "weekly_rest",
      hours: longest,
      message:
        lang === "he"
          ? `${employee.name}: המנוחה הרצופה הארוכה השבוע היא ${hours} שעות. החוק דורש 36 שעות רצופות.`
          : `${employee.name}: the longest unbroken rest this week is ${hours}h. The law requires 36 consecutive hours.`,
    },
  ];
}

function gapNotes(employee: Employee, work: Work[], lang: "he" | "en"): LaborNote[] {
  const sorted = [...work].sort((left, right) => left.start - right.start);
  const notes: LaborNote[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const gap = sorted[index + 1].start - sorted[index].end;
    const touches = sorted[index + 1].start > 0 && sorted[index].end < 168;
    if (sorted[index].iso === sorted[index + 1].iso || !touches || gap < 0 || gap >= BETWEEN_DAYS_HOURS - 1e-9) continue;
    const hours = hourCount(gap);
    notes.push({
      key: `daily-gap#${employee.id}#${Math.round(sorted[index].end * 100)}`,
      employeeId: employee.id,
      code: "daily_gap",
      hours: gap,
      message:
        lang === "he"
          ? `${employee.name}: ${hours} שעות בין משמרות. החוק דורש 8 שעות לפחות בין יום עבודה למשנהו.`
          : `${employee.name}: ${hours}h between shifts. The law requires at least 8 hours between work days.`,
    });
  }
  return notes;
}

function groupedDays(work: Work[]): Map<string, { hours: number; night: number }> {
  const days = new Map<string, { hours: number; night: number }>();
  for (const item of work) {
    const current = days.get(item.iso) ?? { hours: 0, night: 0 };
    current.hours += item.end - item.start;
    current.night += nightHours(item.start, item.end);
    days.set(item.iso, current);
  }
  return days;
}

function dayNotes(employee: Employee, work: Work[], lang: "he" | "en"): LaborNote[] {
  const notes: LaborNote[] = [];
  for (const [iso, day] of groupedDays(work)) {
    if (day.hours <= DAY_CAP_HOURS + 1e-9) continue;
    const hours = hourCount(day.hours);
    notes.push({
      key: `day-cap#${employee.id}#${iso}`,
      employeeId: employee.id,
      code: "day_cap",
      hours: day.hours,
      message:
        lang === "he"
          ? `${employee.name}: ביום ${dayName(iso, lang)} ${hours} שעות עבודה. ההיתר הכללי מגביל יום עבודה ל-12 שעות, כולל שעות נוספות.`
          : `${employee.name}: ${dayName(iso, lang)} has ${hours}h of work. The general permit limits a work day to 12 hours, including overtime.`,
    });
  }
  return notes;
}

function ordinaryHours(employee: Employee, iso: string, night: number): number {
  if (night >= NIGHT_MARK_HOURS - 1e-9) return SHORT_DAY_HOURS;
  if (employee.observesShabbat === true && weekday(iso) === 5) return SHORT_DAY_HOURS;
  return ORDINARY_DAY_HOURS;
}

function overtimeNote(employee: Employee, work: Work[], lang: "he" | "en"): LaborNote[] {
  let dailyOvertime = 0;
  let regular = 0;
  for (const [iso, day] of groupedDays(work)) {
    const ordinary = ordinaryHours(employee, iso, day.night);
    const extra = Math.max(0, day.hours - ordinary);
    dailyOvertime += extra;
    regular += day.hours - extra;
  }
  const total = dailyOvertime + Math.max(0, regular - ORDINARY_WEEK_HOURS);
  if (total <= OVERTIME_CAP_HOURS + 1e-9) return [];
  const hours = hourCount(total);
  return [
    {
      key: `overtime#${employee.id}`,
      employeeId: employee.id,
      code: "overtime",
      hours: total,
      message:
        lang === "he"
          ? `${employee.name}: ${hours} שעות נוספות השבוע. ההיתר הכללי מתיר עד 16.`
          : `${employee.name}: ${hours} overtime hours this week. The general permit allows up to 16.`,
    },
  ];
}

const SATURDAY_START = 6 * 24;
const SATURDAY_END = 7 * 24;
const CONSECUTIVE_SHABBAT_WEEKS = 4;

/** Saturday work, including a Friday shift that continues into Saturday. */
function workedWeeklyRestDay(state: RotaState, employeeId: string, week: string): boolean {
  const schedule = state.sched[week];
  if (schedule) {
    for (const [slotKey, ids] of Object.entries(schedule.assign ?? {})) {
      if (!ids?.includes(employeeId)) continue;
      const pipe = slotKey.indexOf("|");
      const day = Number(slotKey.slice(0, pipe));
      const shiftId = slotKey.slice(pipe + 1);
      if (pipe <= 0 || day < 0 || day > 6) continue;
      const shift = state.biz.shifts.find((item) => item.id === shiftId);
      if (!shift) continue;
      const start = day * 24 + parseClock(shift.start);
      const slot: Slot = {
        key: slotKey,
        day,
        shiftId,
        start,
        end: start + durationHours(shift.start, shift.end),
        required: 0,
      };
      const effective = effectiveSlot(schedule, slot, employeeId);
      if (effective.end > SATURDAY_START + 1e-9 && effective.start < SATURDAY_END - 1e-9) return true;
    }
  }
  for (const peer of state.peers?.[employeeId] ?? []) {
    if (addDays(state.week, peer.weekOffset) !== week) continue;
    const saturdayStart = (peer.weekOffset + 6) * 24;
    if (peer.end > saturdayStart + 1e-9 && peer.start < saturdayStart + 24 - 1e-9) return true;
  }
  return false;
}

function shabbatRunNote(state: RotaState, employee: Employee, week: string, lang: "he" | "en"): LaborNote[] {
  if (!workedWeeklyRestDay(state, employee.id, week)) return [];
  let from = week;
  let to = week;
  for (let step = 0; step < 104 && workedWeeklyRestDay(state, employee.id, addDays(from, -7)); step += 1) {
    from = addDays(from, -7);
  }
  for (let step = 0; step < 104 && workedWeeklyRestDay(state, employee.id, addDays(to, 7)); step += 1) {
    to = addDays(to, 7);
  }
  let weeks = 0;
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 7)) weeks += 1;
  if (weeks < CONSECUTIVE_SHABBAT_WEEKS) return [];
  const start = addDays(from, 6);
  const end = addDays(to, 6);
  return [
    {
      key: `shabbat-run#${employee.id}#${start}`,
      employeeId: employee.id,
      code: "consecutive_shabbat",
      message:
        lang === "he"
          ? `${employee.name}: ${weeks} שבתות ברצף (${dot(start)}–${dot(end)}). לפי ההיתר הכללי, יום המנוחה השבועית צריך להיכלל במנוחה לפחות אחת לארבעה שבועות.`
          : `${employee.name}: ${weeks} consecutive weekly rest days (${dot(start)}–${dot(end)}). The general permit requires the weekly rest day at least once every four weeks.`,
    },
  ];
}

function nightShiftCount(work: Work[], from: string, to: string): number {
  let count = 0;
  for (const item of work) {
    if (item.iso < from || item.iso > to) continue;
    if (nightHours(item.start, item.end) >= NIGHT_MARK_HOURS - 1e-9) count += 1;
  }
  return count;
}

function nightNote(employee: Employee, work: Work[], week: string, lang: "he" | "en"): LaborNote[] {
  const windows = [
    { from: addDays(week, -7), to: addDays(week, 6) },
    { from: week, to: addDays(week, 13) },
  ];
  const notes: LaborNote[] = [];
  for (const window of windows) {
    const count = nightShiftCount(work, window.from, window.to);
    if (count <= NIGHT_SHIFTS_PER_FORTNIGHT) continue;
    notes.push({
      key: `night#${employee.id}#${window.from}`,
      employeeId: employee.id,
      code: "night_weeks",
      message:
        lang === "he"
          ? `${employee.name}: ${count} משמרות לילה בשבועיים (${dot(window.from)}–${dot(window.to)}). מותרות עד 7 משמרות לילה בשבועיים.`
          : `${employee.name}: ${count} night shifts in two weeks (${dot(window.from)}–${dot(window.to)}). Up to 7 night shifts are allowed in two weeks.`,
    });
  }
  return notes;
}

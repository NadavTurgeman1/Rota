import { absenceOnDate, type AbsenceKind } from "../domain/absence";
import { consecutiveStreaks, laborNotes } from "../domain/labor";
import { employeeName } from "../people/edit";
import { effectiveSlot } from "../domain/schedule";
import { addDays, formatClock, hasRequiredRole, slots, sundayOnOrBefore, type LaborNote, type Lang, type RotaState, type Slot } from "../domain";
import { wallInstant } from "../domain/messages";

/** A clock punch. Only `in` is matched to a shift. */
export interface ClockPunch {
  id: string;
  employeeId: string;
  kind: "in" | "out";
  punchedAt: string;
}

export type InsightSpan = "day" | "week" | "month" | "quarter";

export type Arrival = "early" | "late" | "on-time" | "missing" | "waiting" | "absent" | "scheduled";

export interface ArrivalRow {
  employeeId: string;
  name: string;
  arrival: Arrival;
  absence: AbsenceKind | null;
  punchedAt: string | null;
  /** Minutes early or late. Zero when the punch is on time. */
  minutes: number;
}

export interface DayShift {
  key: string;
  day: number;
  shiftId: string;
  required: number;
  /** Null when clock punches have not been loaded. */
  clocked: number | null;
  people: ArrivalRow[];
}

/** Someone placed on a shift through a secondary role, not their primary one. */
export interface SecondaryFill {
  employeeId: string;
  name: string;
  date: string;
  shiftId: string;
  shiftName: string;
  role: string;
}

export interface Shortage {
  date: string;
  day: number;
  shiftId: string;
  shiftName: string;
  role: string;
  filled: number;
  required: number;
}

export interface LateMark {
  employeeId: string;
  name: string;
  date: string;
  shiftId: string;
  shiftName: string;
  minutes: number;
  punchedAt: string;
}

export interface MissedShift {
  employeeId: string;
  name: string;
  date: string;
  shiftId: string;
  shiftName: string;
}

export interface RecurringGap {
  shiftId: string;
  shiftName: string;
  role: string;
  times: number;
  missing: number;
}

export interface IdlePerson {
  employeeId: string;
  name: string;
  /** Days since the last assignment on or before today. */
  days: number;
  last: string | null;
}

export type PatternKind = "late" | "noshow" | "overload";

export interface Pattern {
  employeeId: string;
  name: string;
  kind: PatternKind;
  count: number;
}

export interface HireHint {
  shiftId: string;
  shiftName: string;
  role: string;
  shortDays: number;
  hire: number;
}

export interface BurnoutHint {
  employeeId: string;
  name: string;
  code: LaborNote["code"];
  message: string;
}

export interface LaborGroup {
  code: LaborNote["code"];
  count: number;
  notes: LaborNote[];
}

export interface InsightReport {
  from: string;
  to: string;
  labor: LaborGroup[];
  shortages: Shortage[];
  /** Placements that used a secondary role. Empty means nobody needed one. */
  secondaryFills: SecondaryFill[];
  late: LateMark[];
  noShows: MissedShift[];
  recurring: RecurringGap[];
  idle: IdlePerson[];
  patterns: Pattern[];
  hiring: HireHint[];
  burnout: BurnoutHint[];
}

const LABOR_CODES: LaborNote["code"][] = [
  "consecutive_days",
  "weekly_rest",
  "daily_gap",
  "day_cap",
  "overtime",
  "night_weeks",
  "consecutive_shabbat",
];

const EARLY_MS = 3 * 60 * 60 * 1000;
const ON_TIME_MINUTES = 1;
const IDLE_DAYS = 15;
const LATE_PATTERN = 3;
const NOSHOW_PATTERN = 2;
const OVERLOAD_PATTERN = 2;

/** `YYYY-MM-DD` in `timeZone`. */
export function zonedDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function daySpan(from: string, to: string): number {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

function monthEnd(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/** Inclusive dates for the period that contains `now` in the site timezone. */
export function spanRange(span: InsightSpan, now: Date, timeZone: string): { from: string; to: string } {
  const today = zonedDate(now, timeZone);
  if (span === "day") return { from: today, to: today };
  if (span === "week") {
    const start = sundayOnOrBefore(today);
    return { from: start, to: addDays(start, 6) };
  }
  const [year, month] = today.split("-").map(Number);
  if (span === "month") return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: monthEnd(year, month) };
  const startMonth = month - 2;
  const startYear = startMonth < 1 ? year - 1 : year;
  const monthIndex = ((startMonth - 1 + 12) % 12) + 1;
  return { from: `${startYear}-${String(monthIndex).padStart(2, "0")}-01`, to: today };
}

interface Seat {
  id: string;
  week: string;
  date: string;
  slot: Slot;
  employeeId: string;
  name: string;
  shiftName: string;
  role: string;
  startAt: number;
  endAt: number;
}

function shiftMeta(state: RotaState, shiftId: string): { name: string; role: string; start: string; end: string } | null {
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  if (!shift) return null;
  return { name: shift.name, role: shift.role, start: shift.start, end: shift.end };
}

function seatsInRange(state: RotaState, from: string, to: string, timeZone: string): Seat[] {
  const seats: Seat[] = [];
  for (let week = sundayOnOrBefore(from); week <= to; week = addDays(week, 7)) {
    const schedule = state.sched[week];
    if (!schedule) continue;
    for (const slot of slots(state, week)) {
      const date = addDays(week, slot.day);
      if (date < from || date > to) continue;
      const meta = shiftMeta(state, slot.shiftId);
      if (!meta) continue;
      const seen = new Set<string>();
      for (const employeeId of schedule.assign[slot.key] ?? []) {
        if (seen.has(employeeId)) continue;
        seen.add(employeeId);
        const effective = effectiveSlot(schedule, slot, employeeId);
        const startDate = addDays(week, Math.floor(effective.start / 24));
        let startAt = Number.NaN;
        try {
          startAt = Date.parse(wallInstant(startDate, formatClock(effective.start), timeZone));
        } catch {
          continue;
        }
        if (!Number.isFinite(startAt)) continue;
        seats.push({
          id: `${week}|${slot.key}|${employeeId}`,
          week,
          date,
          slot,
          employeeId,
          name: employeeName(state, employeeId),
          shiftName: meta.name,
          role: meta.role,
          startAt,
          endAt: startAt + (effective.end - effective.start) * 3_600_000,
        });
      }
    }
  }
  return seats;
}

interface Claim {
  punch: ClockPunch;
  minutes: number;
}

/** Match each clock-in to one assigned shift. A punch during a shift beats an early arrival to the next one. */
function matchClocks(seats: Seat[], clocks: ClockPunch[]): Map<string, Claim> {
  const claimed = new Map<string, Claim>();
  const taken = new Set<string>();
  const byPerson = new Map<string, Seat[]>();
  for (const seat of seats) {
    const list = byPerson.get(seat.employeeId) ?? [];
    list.push(seat);
    byPerson.set(seat.employeeId, list);
  }
  const punches = clocks
    .filter((punch) => punch.kind === "in")
    .sort((left, right) => left.punchedAt.localeCompare(right.punchedAt) || left.id.localeCompare(right.id));
  for (const punch of punches) {
    const at = Date.parse(punch.punchedAt);
    if (!Number.isFinite(at)) continue;
    const open = (byPerson.get(punch.employeeId) ?? []).filter((seat) => !taken.has(seat.id));
    const during = open.filter((seat) => at >= seat.startAt && at <= seat.endAt).sort((left, right) => right.startAt - left.startAt);
    const upcoming = open
      .filter((seat) => at >= seat.startAt - EARLY_MS && at < seat.startAt)
      .sort((left, right) => left.startAt - right.startAt);
    const seat = during[0] ?? upcoming[0];
    if (!seat) continue;
    taken.add(seat.id);
    claimed.set(seat.id, { punch, minutes: Math.round((at - seat.startAt) / 60_000) });
  }
  return claimed;
}

function arrivalOf(claim: Claim | undefined, absent: AbsenceKind | null, started: boolean, clocksKnown: boolean): Arrival {
  if (!clocksKnown) return "scheduled";
  if (absent && !claim) return "absent";
  if (!claim) return started ? "missing" : "waiting";
  if (claim.minutes > ON_TIME_MINUTES) return "late";
  if (claim.minutes < -ON_TIME_MINUTES) return "early";
  return "on-time";
}

/** Read-only week: who is assigned, who clocked in, and whether they were early or late. */
export function weekAttendance(state: RotaState, timeZone: string, now: Date, clocks: ClockPunch[] | null): DayShift[] {
  const seats = seatsInRange(state, state.week, addDays(state.week, 6), timeZone);
  const claims = clocks ? matchClocks(seats, clocks) : new Map<string, Claim>();
  const nowMs = now.getTime();
  const grouped = new Map<string, DayShift>();
  for (const slot of slots(state, state.week)) {
    grouped.set(slot.key, { key: slot.key, day: slot.day, shiftId: slot.shiftId, required: slot.required, clocked: clocks ? 0 : null, people: [] });
  }
  for (const seat of seats) {
    const row = grouped.get(seat.slot.key);
    if (!row) continue;
    const claim = claims.get(seat.id);
    const absence = claim ? null : absenceOnDate(state.absences, seat.employeeId, seat.date);
    const arrival = arrivalOf(claim, absence, nowMs >= seat.startAt, clocks !== null);
    if (claim && row.clocked !== null) row.clocked += 1;
    row.people.push({
      employeeId: seat.employeeId,
      name: seat.name,
      arrival,
      absence,
      punchedAt: claim?.punch.punchedAt ?? null,
      minutes: claim ? Math.abs(claim.minutes) : 0,
    });
  }
  return [...grouped.values()];
}

function noteTouches(state: RotaState, note: LaborNote, week: string, from: string, to: string): boolean {
  if (note.code === "day_cap") {
    const date = note.key.split("#")[2] ?? "";
    return date >= from && date <= to;
  }
  if (note.code === "consecutive_days") {
    const start = note.key.split("#")[2] ?? "";
    const streak = consecutiveStreaks(state, note.employeeId, sundayOnOrBefore(start || week)).find((item) => item.from === start);
    if (!streak) return start >= from && start <= to;
    return streak.from <= to && streak.to >= from;
  }
  if (note.code === "night_weeks") {
    const start = note.key.split("#")[2] ?? "";
    return start <= to && addDays(start, 13) >= from;
  }
  if (from !== to) return true;
  return workedOn(state, note.employeeId, from);
}

function workedOn(state: RotaState, employeeId: string, date: string): boolean {
  const week = sundayOnOrBefore(date);
  const schedule = state.sched[week];
  if (!schedule) return false;
  for (const [key, ids] of Object.entries(schedule.assign ?? {})) {
    if (!ids?.includes(employeeId)) continue;
    const day = Number(key.slice(0, key.indexOf("|")));
    if (day >= 0 && day <= 6 && addDays(week, day) === date) return true;
  }
  return false;
}

function laborInRange(state: RotaState, from: string, to: string, lang: Lang): LaborNote[] {
  const seen = new Set<string>();
  const notes: LaborNote[] = [];
  for (let week = sundayOnOrBefore(from); week <= to; week = addDays(week, 7)) {
    const viewed = { ...state, week, peers: week === state.week ? state.peers : undefined };
    for (const note of laborNotes(viewed, week, lang)) {
      if (!noteTouches(viewed, note, week, from, to)) continue;
      const id = note.code === "weekly_rest" || note.code === "overtime" || note.code === "daily_gap" ? `${week}#${note.key}` : note.key;
      if (seen.has(id)) continue;
      seen.add(id);
      notes.push({ ...note, key: id });
    }
  }
  return notes;
}

function groupLabor(notes: LaborNote[]): LaborGroup[] {
  return LABOR_CODES.map((code) => {
    const matching = notes.filter((note) => note.code === code);
    return { code, count: matching.length, notes: matching };
  });
}

function shortagesInRange(state: RotaState, from: string, to: string): Shortage[] {
  const rows: Shortage[] = [];
  for (let week = sundayOnOrBefore(from); week <= to; week = addDays(week, 7)) {
    const schedule = state.sched[week];
    if (!schedule) continue;
    for (const slot of slots(state, week)) {
      const date = addDays(week, slot.day);
      if (date < from || date > to) continue;
      const meta = shiftMeta(state, slot.shiftId);
      if (!meta) continue;
      const filled = new Set(schedule.assign[slot.key] ?? []).size;
      if (filled >= slot.required) continue;
      rows.push({ date, day: slot.day, shiftId: slot.shiftId, shiftName: meta.name, role: meta.role, filled, required: slot.required });
    }
  }
  return rows;
}

function recurringGaps(shortages: Shortage[]): RecurringGap[] {
  const groups = new Map<string, Shortage[]>();
  for (const row of shortages) {
    const list = groups.get(row.shiftId) ?? [];
    list.push(row);
    groups.set(row.shiftId, list);
  }
  const gaps: RecurringGap[] = [];
  for (const [shiftId, rows] of groups) {
    if (rows.length < 2) continue;
    const missing = Math.round(rows.reduce((sum, row) => sum + (row.required - row.filled), 0) / rows.length);
    gaps.push({
      shiftId,
      shiftName: rows[0].shiftName,
      role: rows[0].role,
      times: rows.length,
      missing: Math.max(1, missing),
    });
  }
  gaps.sort((left, right) => right.times - left.times || left.shiftName.localeCompare(right.shiftName));
  return gaps;
}

function hireThreshold(span: InsightSpan): number {
  if (span === "week") return 3;
  if (span === "month") return 4;
  if (span === "quarter") return 6;
  return Number.POSITIVE_INFINITY;
}

function hireHints(shortages: Shortage[], span: InsightSpan): HireHint[] {
  const need = hireThreshold(span);
  const groups = new Map<string, Shortage[]>();
  for (const row of shortages) {
    const list = groups.get(row.shiftId) ?? [];
    list.push(row);
    groups.set(row.shiftId, list);
  }
  const hints: HireHint[] = [];
  for (const [shiftId, rows] of groups) {
    if (rows.length < need) continue;
    const average = rows.reduce((sum, row) => sum + (row.required - row.filled), 0) / rows.length;
    hints.push({
      shiftId,
      shiftName: rows[0].shiftName,
      role: rows[0].role,
      shortDays: rows.length,
      hire: Math.max(1, Math.round(average)),
    });
  }
  hints.sort((left, right) => right.shortDays - left.shortDays || left.shiftName.localeCompare(right.shiftName));
  return hints;
}

function lastAssignment(state: RotaState, employeeId: string, today: string): string | null {
  let last: string | null = null;
  for (const [week, schedule] of Object.entries(state.sched)) {
    for (const [key, ids] of Object.entries(schedule.assign ?? {})) {
      if (!ids?.includes(employeeId)) continue;
      const day = Number(key.slice(0, key.indexOf("|")));
      if (day < 0 || day > 6) continue;
      const date = addDays(week, day);
      if (date <= today && (last === null || date > last)) last = date;
    }
  }
  return last;
}

function idlePeople(state: RotaState, today: string): IdlePerson[] {
  const idle: IdlePerson[] = [];
  for (const employee of state.emps) {
    if (employee.active === false) continue;
    const started = employee.profile?.startedOn ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(started) && daySpan(started, today) <= IDLE_DAYS) continue;
    const last = lastAssignment(state, employee.id, today);
    if (!last) continue;
    const days = daySpan(last, today);
    if (days <= IDLE_DAYS) continue;
    idle.push({ employeeId: employee.id, name: employee.name, days, last });
  }
  idle.sort((left, right) => right.days - left.days || left.name.localeCompare(right.name));
  return idle;
}

function patternsFrom(late: LateMark[], missed: MissedShift[], notes: LaborNote[]): Pattern[] {
  const rows: Pattern[] = [];
  const lateCount = new Map<string, { name: string; count: number }>();
  for (const mark of late) {
    const current = lateCount.get(mark.employeeId) ?? { name: mark.name, count: 0 };
    current.count += 1;
    lateCount.set(mark.employeeId, current);
  }
  for (const [employeeId, row] of lateCount) {
    if (row.count >= LATE_PATTERN) rows.push({ employeeId, name: row.name, kind: "late", count: row.count });
  }
  const missedCount = new Map<string, { name: string; count: number }>();
  for (const mark of missed) {
    const current = missedCount.get(mark.employeeId) ?? { name: mark.name, count: 0 };
    current.count += 1;
    missedCount.set(mark.employeeId, current);
  }
  for (const [employeeId, row] of missedCount) {
    if (row.count >= NOSHOW_PATTERN) rows.push({ employeeId, name: row.name, kind: "noshow", count: row.count });
  }
  const loadCount = new Map<string, { name: string; count: number }>();
  for (const note of notes) {
    if (note.code === "consecutive_shabbat") continue;
    const name = note.message.split(":")[0] ?? "";
    const current = loadCount.get(note.employeeId) ?? { name, count: 0 };
    current.count += 1;
    loadCount.set(note.employeeId, current);
  }
  for (const [employeeId, row] of loadCount) {
    if (row.count >= OVERLOAD_PATTERN) rows.push({ employeeId, name: row.name, kind: "overload", count: row.count });
  }
  return rows;
}

function burnoutFrom(notes: LaborNote[], state: RotaState): BurnoutHint[] {
  const hints: BurnoutHint[] = [];
  const seen = new Set<string>();
  for (const code of LABOR_CODES) {
    for (const note of notes) {
      if (note.code !== code) continue;
      const key = `${note.employeeId}#${code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hints.push({ employeeId: note.employeeId, name: employeeName(state, note.employeeId), code, message: note.message });
    }
  }
  return hints.slice(0, 20);
}

/** Assignments in the period whose shift role is a secondary role of that person. */
function secondaryFillsInRange(state: RotaState, from: string, to: string): SecondaryFill[] {
  const rows: SecondaryFill[] = [];
  for (let week = sundayOnOrBefore(from); week <= to; week = addDays(week, 7)) {
    const schedule = state.sched[week];
    if (!schedule) continue;
    for (const slot of slots(state, week)) {
      const date = addDays(week, slot.day);
      if (date < from || date > to) continue;
      const meta = shiftMeta(state, slot.shiftId);
      if (!meta?.role.trim()) continue;
      const seen = new Set<string>();
      for (const employeeId of schedule.assign[slot.key] ?? []) {
        if (seen.has(employeeId)) continue;
        seen.add(employeeId);
        const employee = state.emps.find((item) => item.id === employeeId);
        if (!employee) continue;
        if (hasRequiredRole(employee, meta.role)) continue;
        if (!hasRequiredRole(employee, meta.role, "any")) continue;
        rows.push({
          employeeId,
          name: employeeName(state, employeeId),
          date,
          shiftId: slot.shiftId,
          shiftName: meta.name,
          role: meta.role,
        });
      }
    }
  }
  return rows;
}

/** Statistics for one period. `clocks` null means punches are not loaded, so attendance figures stay empty. */
export function buildInsights(
  state: RotaState,
  span: InsightSpan,
  lang: Lang,
  timeZone: string,
  now: Date,
  clocks: ClockPunch[] | null,
): InsightReport {
  const { from, to } = spanRange(span, now, timeZone);
  const today = zonedDate(now, timeZone);
  const notes = laborInRange(state, from, to, lang);
  const shortages = shortagesInRange(state, from, to);
  const seats = seatsInRange(state, from, to, timeZone);
  const claims = clocks ? matchClocks(seats, clocks) : new Map<string, Claim>();
  const nowMs = now.getTime();
  const late: LateMark[] = [];
  const noShows: MissedShift[] = [];
  if (clocks) {
    for (const seat of seats) {
      const claim = claims.get(seat.id);
      if (nowMs < seat.startAt) continue;
      if (claim) {
        if (claim.minutes > ON_TIME_MINUTES) {
          late.push({
            employeeId: seat.employeeId,
            name: seat.name,
            date: seat.date,
            shiftId: seat.slot.shiftId,
            shiftName: seat.shiftName,
            minutes: claim.minutes,
            punchedAt: claim.punch.punchedAt,
          });
        }
      } else if (!absenceOnDate(state.absences, seat.employeeId, seat.date)) {
        noShows.push({ employeeId: seat.employeeId, name: seat.name, date: seat.date, shiftId: seat.slot.shiftId, shiftName: seat.shiftName });
      }
    }
  }
  return {
    from,
    to,
    labor: groupLabor(notes),
    shortages,
    secondaryFills: secondaryFillsInRange(state, from, to),
    late,
    noShows,
    recurring: recurringGaps(shortages),
    idle: idlePeople(state, today),
    patterns: patternsFrom(late, noShows, notes),
    hiring: hireHints(shortages, span),
    burnout: burnoutFrom(notes, state),
  };
}

const OPEN_SHIFT_MS = 18 * 60 * 60 * 1000;

/** People whose latest punch is a clock-in from the last 18 hours, with no clock-out after it. */
export function peopleOnSite(punches: ClockPunch[], now: Date): { employeeId: string; punchedAt: string }[] {
  const byPerson = new Map<string, ClockPunch[]>();
  for (const punch of punches) {
    const list = byPerson.get(punch.employeeId) ?? [];
    list.push(punch);
    byPerson.set(punch.employeeId, list);
  }
  const open: { employeeId: string; punchedAt: string }[] = [];
  const nowMs = now.getTime();
  for (const [employeeId, list] of byPerson) {
    list.sort((left, right) => left.punchedAt.localeCompare(right.punchedAt) || left.id.localeCompare(right.id));
    let current: ClockPunch | null = null;
    for (const punch of list) {
      if (punch.kind === "in") current = punch;
      else current = null;
    }
    if (!current) continue;
    const at = Date.parse(current.punchedAt);
    if (!Number.isFinite(at) || at > nowMs || nowMs - at > OPEN_SHIFT_MS) continue;
    open.push({ employeeId, punchedAt: current.punchedAt });
  }
  open.sort((left, right) => right.punchedAt.localeCompare(left.punchedAt));
  return open;
}

/** The clock-out that follows this clock-in, if the next punch is an out. */
export function clockOutAfter(punches: ClockPunch[], employeeId: string, inAt: string): string | null {
  const next = punches
    .filter((punch) => punch.employeeId === employeeId && punch.punchedAt > inAt)
    .sort((left, right) => left.punchedAt.localeCompare(right.punchedAt) || left.id.localeCompare(right.id))[0];
  return next?.kind === "out" ? next.punchedAt : null;
}

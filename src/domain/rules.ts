import { addDays, durationHours, gapBetween, parseClock } from "./time";
import { effectiveSlot, shiftById } from "./schedule";
import type { Employee, Reason, RotaState, Slot } from "./types";

const DAY_NAMES = {
  he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
} as const;

export type Lang = "he" | "en";

export function dayName(day: number, lang: Lang = "he"): string {
  return DAY_NAMES[lang][day] ?? "";
}

export function slots(state: RotaState, _week: string): Slot[] {
  const open: Slot[] = [];
  for (const shift of state.biz.shifts) {
    for (let day = 0; day < 7; day += 1) {
      const required = Number(shift.req[day] || 0);
      if (required <= 0) continue;
      const start = day * 24 + parseClock(shift.start);
      open.push({
        key: `${day}|${shift.id}`,
        day,
        shiftId: shift.id,
        start,
        end: start + durationHours(shift.start, shift.end),
        required,
      });
    }
  }
  return open;
}

export function slotLabel(
  state: RotaState,
  slot: { day: number; shiftId: string },
  lang: Lang = "he",
): string {
  return `${dayName(slot.day, lang)} ${shiftById(state, slot.shiftId).name}`;
}

export function agreementAllows(employee: Employee, day: number, shiftId: string): boolean {
  if (employee.grid) return (employee.grid[day] ?? []).includes(shiftId);
  return (employee.allowed ?? []).includes(shiftId) && !(employee.blocked ?? []).includes(day);
}

function hasRequiredRole(employee: Employee, required: string): boolean {
  const needle = required.trim().toLowerCase();
  if (employee.role.trim().toLowerCase() === needle) return true;
  return employee.quals
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .includes(needle);
}

/** Contract, role, and this week's submitted availability. Not rest or hours. */
export function staticReason(
  state: RotaState,
  employee: Employee,
  slot: Slot,
  week: string,
): Reason | null {
  const shift = shiftById(state, slot.shiftId);
  if (!employee.active) return { code: "inactive" };
  if (!agreementAllows(employee, slot.day, slot.shiftId)) {
    return { code: "agreement", day: slot.day, shiftName: shift.name };
  }
  if (shift.role && !hasRequiredRole(employee, shift.role)) {
    return { code: "role", role: shift.role };
  }
  const submitted = state.avail[week]?.[employee.id];
  if (submitted && !(submitted[slot.day] ?? []).includes(slot.shiftId)) {
    return { code: "unavailable", day: slot.day, shiftName: shift.name };
  }
  return null;
}

/**
 * Approved over-quota shifts on the week stored in `state.week`.
 * The prototype reads the edited week, not the week argument of the caller.
 */
export function approvedExtraShifts(state: RotaState, employeeId: string): number {
  const schedule = state.sched[state.week];
  if (!schedule?.over) return 0;
  return Object.keys(schedule.over).filter((key) => {
    const splitAt = key.lastIndexOf("#");
    if (splitAt < 0) return false;
    const slotKey = key.slice(0, splitAt);
    const id = key.slice(splitAt + 1);
    return id === employeeId && (schedule.assign[slotKey] ?? []).includes(employeeId);
  }).length;
}

function boundaryShifts(state: RotaState, employeeId: string): Array<Slot & { weekOffset: number }> {
  const adjacent: Array<Slot & { weekOffset: number }> = [];
  for (const [dayOffset, hourOffset] of [
    [-7, -168],
    [7, 168],
  ] as const) {
    const week = addDays(state.week, dayOffset);
    const schedule = state.sched[week];
    if (!schedule) continue;
    for (const slot of slots(state, week)) {
      if (!(schedule.assign[slot.key] ?? []).includes(employeeId)) continue;
      const effective = effectiveSlot(schedule, slot, employeeId);
      adjacent.push({
        ...effective,
        start: effective.start + hourOffset,
        end: effective.end + hourOffset,
        weekOffset: dayOffset,
      });
    }
  }
  return adjacent;
}

/** Overlap, rest, weekly hours, and the agreed shift count. `mine` is other work already held. */
export function dynamicReason(
  state: RotaState,
  employee: Employee,
  slot: Slot,
  mine: Slot[],
  lang: Lang = "he",
): Reason | null {
  const shiftLimit = state.biz.maxShift > 0 ? state.biz.maxShift : 12;
  if (slot.end - slot.start > shiftLimit + 1e-9) return { code: "shift_length", cap: shiftLimit };
  const peers = state.peers?.[employee.id] ?? [];
  const sameWeek = peers.filter((peer) => peer.weekOffset === 0);
  let hours = slot.end - slot.start;
  let count = 1;
  for (const other of mine) {
    if (other.key === slot.key) continue;
    count += 1;
    hours += other.end - other.start;
    const gap = gapBetween(slot, other);
    const label = slotLabel(state, other, lang);
    if (gap < 0) return { code: "overlap", label };
    if (gap < state.biz.minRest) return { code: "rest", hours: gap, label };
  }
  for (const peer of sameWeek) {
    count += 1;
    hours += peer.end - peer.start;
    const gap = gapBetween(slot, peer);
    const needed = Math.max(state.biz.minRest, peer.minRest);
    if (gap < 0) return { code: "overlap", label: peer.label };
    if (gap < needed) return { code: "rest", hours: gap, label: peer.label };
  }
  for (const other of boundaryShifts(state, employee.id)) {
    const gap = gapBetween(slot, other);
    const when =
      other.weekOffset > 0
        ? lang === "he"
          ? "השבוע הבא"
          : "next week"
        : lang === "he"
          ? "השבוע הקודם"
          : "previous week";
    const label = `${slotLabel(state, other, lang)} (${when})`;
    if (gap < 0) return { code: "overlap", label };
    if (gap < state.biz.minRest) return { code: "rest", hours: gap, label };
  }
  for (const peer of peers) {
    if (peer.weekOffset === 0) continue;
    const gap = gapBetween(slot, peer);
    const needed = Math.max(state.biz.minRest, peer.minRest);
    const when =
      peer.weekOffset > 0
        ? lang === "he"
          ? "השבוע הבא"
          : "next week"
        : lang === "he"
          ? "השבוע הקודם"
          : "previous week";
    if (gap < 0) return { code: "overlap", label: `${peer.label} (${when})` };
    if (gap < needed) return { code: "rest", hours: gap, label: `${peer.label} (${when})` };
  }
  let dailyCap = state.biz.maxDayHours || 0;
  let cap = Math.min(employee.maxHours || 999, state.biz.maxHours);
  for (const peer of sameWeek) {
    if (peer.maxDayHours > 0) dailyCap = dailyCap > 0 ? Math.min(dailyCap, peer.maxDayHours) : peer.maxDayHours;
    cap = Math.min(cap, peer.maxHours);
  }
  if (dailyCap > 0) {
    let dayHours = slot.end - slot.start;
    for (const other of mine) {
      if (other.key === slot.key || other.day !== slot.day) continue;
      dayHours += other.end - other.start;
    }
    for (const peer of sameWeek) {
      if (peer.day !== slot.day) continue;
      dayHours += peer.end - peer.start;
    }
    if (dayHours > dailyCap + 1e-9) return { code: "daily_hours", cap: dailyCap };
  }
  if (hours > cap) return { code: "weekly_hours", cap };
  const agreed = employee.perWeek;
  if (agreed && count > agreed + approvedExtraShifts(state, employee.id)) {
    return { code: "weekly_shifts", agreed };
  }
  return null;
}

function hourCount(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  if (Math.abs(rounded) < 0.05) return "0";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatReason(reason: Reason, lang: "en" | "he" = "he"): string {
  switch (reason.code) {
    case "inactive":
      return lang === "he" ? "העובד לא פעיל" : "Inactive";
    case "agreement":
      return lang === "he"
        ? `ההסכם לא כולל משמרת ${reason.shiftName} ביום ${dayName(reason.day, lang)}`
        : `The agreement does not include ${dayName(reason.day, lang)} ${reason.shiftName}`;
    case "role":
      return lang === "he" ? `אין הסמכה למשמרת הזו (${reason.role})` : `Missing the qualification for this shift (${reason.role})`;
    case "unavailable":
      return lang === "he"
        ? `סומן באילוצים כלא זמין למשמרת ${reason.shiftName} ביום ${dayName(reason.day, lang)}`
        : `Marked unavailable for ${dayName(reason.day, lang)} ${reason.shiftName}`;
    case "overlap":
      return lang === "he" ? `כבר משובץ באותו זמן: ${reason.label}` : `Already working at the same time: ${reason.label}`;
    case "rest": {
      const hours = hourCount(reason.hours);
      if (lang === "he") return hours === "0" ? `אין מנוחה ליד ${reason.label}` : `רק ${hours} שעות מנוחה ליד ${reason.label}`;
      return hours === "0" ? `No rest next to ${reason.label}` : `Only ${hours}h rest next to ${reason.label}`;
    }
    case "weekly_hours":
      return lang === "he" ? `עובר את ${reason.cap} השעות המותרות השבוע` : `Over the weekly limit of ${reason.cap}h`;
    case "daily_hours":
      return lang === "he" ? `עובר את ${reason.cap} השעות המותרות ביום` : `Over the daily limit of ${reason.cap}h`;
    case "weekly_shifts":
      return lang === "he" ? `כבר הגיע ל־${reason.agreed} המשמרות שבהסכם` : `Already at the agreed ${reason.agreed} shifts`;
    case "shift_length":
      return lang === "he" ? `המשמרת ארוכה מ־${reason.cap} שעות` : `Longer than the ${reason.cap}h limit`;
    case "home_schedule":
      return lang === "he" ? "הסידור באתר הראשי עוד לא מוכן" : "The home site's week is not ready to publish";
  }
}

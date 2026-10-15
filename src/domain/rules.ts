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
  const dailyCap = state.biz.maxDayHours || 0;
  if (dailyCap > 0) {
    let dayHours = slot.end - slot.start;
    for (const other of mine) {
      if (other.key === slot.key || other.day !== slot.day) continue;
      dayHours += other.end - other.start;
    }
    if (dayHours > dailyCap + 1e-9) return { code: "daily_hours", cap: dailyCap };
  }
  const cap = Math.min(employee.maxHours || 999, state.biz.maxHours);
  if (hours > cap) return { code: "weekly_hours", cap };
  const agreed = employee.perWeek;
  if (agreed && count > agreed + approvedExtraShifts(state, employee.id)) {
    return { code: "weekly_shifts", agreed };
  }
  return null;
}

export function formatReason(reason: Reason, lang: "en" | "he" = "he"): string {
  switch (reason.code) {
    case "inactive":
      return lang === "he" ? "לא פעיל" : "inactive";
    case "agreement":
      return lang === "he"
        ? `לפי ההסכם אינו עובד ${dayName(reason.day, lang)} ${reason.shiftName}`
        : `agreement excludes ${dayName(reason.day, lang)} ${reason.shiftName}`;
    case "role":
      return lang === "he" ? `חסרה הסמכה "${reason.role}"` : `lacks required role "${reason.role}"`;
    case "unavailable":
      return lang === "he"
        ? `לא זמין ${dayName(reason.day, lang)} ${reason.shiftName} השבוע`
        : `unavailable ${dayName(reason.day, lang)} ${reason.shiftName} this week`;
    case "overlap":
      return lang === "he" ? `חופף עם ${reason.label}` : `overlaps ${reason.label}`;
    case "rest":
      return lang === "he"
        ? `רק ${reason.hours} שעות מנוחה ליד ${reason.label}`
        : `only ${reason.hours}h rest next to ${reason.label}`;
    case "weekly_hours":
      return lang === "he"
        ? `חורג ממגבלת השעות השבועית (${reason.cap} שעות)`
        : `exceeds weekly hours cap (${reason.cap}h)`;
    case "daily_hours":
      return lang === "he"
        ? `חורג מתקרת השעות היומית (${reason.cap} שעות)`
        : `exceeds the daily hour cap (${reason.cap}h)`;
    case "weekly_shifts":
      return lang === "he"
        ? `חורג מ-${reason.agreed} המשמרות השבועיות המוסכמות`
        : `exceeds agreed ${reason.agreed} shifts/week`;
  }
}

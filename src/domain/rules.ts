import { absenceOnWeekDay } from "./absence";
import { addDays, durationHours, gapBetween, parseClock } from "./time";
import { effectiveSlot, shiftById } from "./schedule";
import { shabbatBlocks, shiftRest, staffedCount } from "./rest";
import { tx } from "./text";
import type { Employee, Reason, RotaState, Slot } from "./types";

const DAY_NAMES = {
  he: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  ru: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
} as const;

export type Lang = "he" | "en" | "ru";

export function dayName(day: number, lang: Lang = "he"): string {
  return DAY_NAMES[lang][day] ?? "";
}

export function slots(state: RotaState, week: string): Slot[] {
  const open: Slot[] = [];
  for (const shift of state.biz.shifts) {
    for (let day = 0; day < 7; day += 1) {
      const override = state.sched[week]?.staffing?.[`${day}|${shift.id}`];
      const required =
        override !== undefined && Number.isFinite(override) ? Math.trunc(override) : staffedCount(shift, day, week);
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

export function agreementAllows(
  employee: Employee,
  day: number,
  shiftId: string,
  shift?: { start: string; end: string },
): boolean {
  if (shift && shabbatBlocks(employee, shift, day)) return false;
  if (employee.grid) return (employee.grid[day] ?? []).includes(shiftId);
  return (employee.allowed ?? []).includes(shiftId) && !(employee.blocked ?? []).includes(day);
}

/** Trimmed role names, without duplicates. Comparison ignores letter case. */
export function roleNames(value: unknown): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim().startsWith("[")
      ? parsedList(value)
      : [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of source) {
    if (typeof item !== "string") continue;
    const name = item.trim().replace(/\s+/g, " ");
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function parsedList(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The primary role, then the secondary ones, without duplicates. */
export function heldRoles(employee: { role: string; secondaryRoles?: string[] }): string[] {
  return roleNames([employee.role, ...secondaryRoles(employee)]);
}

/** A shift with no role is for everyone. A role-specific shift is only for someone who holds that role. */
export function shiftVisible(employee: { role: string; secondaryRoles?: string[] }, shift: { role: string }): boolean {
  const role = shift.role.trim().toLowerCase();
  if (!role) return true;
  return heldRoles(employee).some((item) => item.toLowerCase() === role);
}

/** Roles besides the primary one. The primary role is never repeated here. */
export function secondaryRoles(employee: { role: string; secondaryRoles?: string[] }): string[] {
  const primary = employee.role.trim().toLowerCase();
  return roleNames(employee.secondaryRoles).filter((role) => role.toLowerCase() !== primary);
}

/**
 * `primary` is the role automatic scheduling uses.
 * `any` also accepts a secondary role, for a manual placement or a solution to an open seat.
 */
export function hasRequiredRole(employee: Employee, required: string, match: "primary" | "any" = "primary"): boolean {
  const needle = required.trim().toLowerCase();
  if (!needle) return true;
  if (employee.role.trim().toLowerCase() === needle) return true;
  return match === "any" && secondaryRoles(employee).some((role) => role.toLowerCase() === needle);
}

/** Contract, role, and this week's submitted availability. Not rest or hours. */
export function staticReason(
  state: RotaState,
  employee: Employee,
  slot: Slot,
  week: string,
  match: "primary" | "any" = "primary",
): Reason | null {
  const shift = shiftById(state, slot.shiftId);
  if (!employee.active) return { code: "inactive" };
  const absent = absenceOnWeekDay(state, employee.id, slot.day, week);
  if (absent) return { code: "absent", day: slot.day, kind: absent };
  const observance = shiftRest(employee, shift, slot.day, week);
  if (observance) return { code: observance };
  if (!agreementAllows(employee, slot.day, slot.shiftId, shift)) {
    return { code: "agreement", day: slot.day, shiftName: shift.name };
  }
  if (shift.role && !hasRequiredRole(employee, shift.role, match)) {
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
        ? tx(lang, "השבוע הבא", "next week", "следующая неделя")
        : tx(lang, "השבוע הקודם", "previous week", "прошлая неделя");
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
        ? tx(lang, "השבוע הבא", "next week", "следующая неделя")
        : tx(lang, "השבוע הקודם", "previous week", "прошлая неделя");
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

export function formatReason(reason: Reason, lang: Lang = "he"): string {
  const day = "day" in reason ? dayName(reason.day, lang) : "";
  switch (reason.code) {
    case "inactive":
      return tx(lang, "העובד לא פעיל", "Inactive", "Сотрудник неактивен");
    case "agreement":
      return tx(
        lang,
        `ההסכם לא כולל משמרת ${reason.shiftName} ביום ${day}`,
        `The agreement does not include ${day} ${reason.shiftName}`,
        `Соглашение не включает смену ${reason.shiftName} в день ${day}`,
      );
    case "role":
      return tx(
        lang,
        `אין את התפקיד הנדרש למשמרת הזו (${reason.role})`,
        `Does not hold this shift's role (${reason.role})`,
        `Нет нужной роли для этой смены (${reason.role})`,
      );
    case "unavailable":
      return tx(
        lang,
        `סומן באילוצים כלא זמין למשמרת ${reason.shiftName} ביום ${day}`,
        `Marked unavailable for ${day} ${reason.shiftName}`,
        `В ограничениях отмечен как недоступный на смену ${reason.shiftName} в день ${day}`,
      );
    case "absent": {
      const kind = reason.kind === "sick" ? tx(lang, "מחלה", "sick leave", "больничный") : tx(lang, "חופשה", "vacation", "отпуск");
      return tx(lang, `${kind} ביום ${day}`, `${kind} on ${day}`, `${kind}, день ${day}`);
    }
    case "overlap":
      return tx(lang, `כבר משובץ באותו זמן: ${reason.label}`, `Already working at the same time: ${reason.label}`, `Уже работает в это время: ${reason.label}`);
    case "rest": {
      const hours = hourCount(reason.hours);
      return hours === "0"
        ? tx(lang, `אין מנוחה ליד ${reason.label}`, `No rest next to ${reason.label}`, `Нет отдыха рядом с ${reason.label}`)
        : tx(lang, `רק ${hours} שעות מנוחה ליד ${reason.label}`, `Only ${hours}h rest next to ${reason.label}`, `Только ${hours} ч отдыха рядом с ${reason.label}`);
    }
    case "weekly_hours":
      return tx(lang, `עובר את ${reason.cap} השעות המותרות השבוע`, `Over the weekly limit of ${reason.cap}h`, `Больше недельного предела в ${reason.cap} ч`);
    case "daily_hours":
      return tx(lang, `עובר את ${reason.cap} השעות המותרות ביום`, `Over the daily limit of ${reason.cap}h`, `Больше дневного предела в ${reason.cap} ч`);
    case "weekly_shifts":
      return tx(lang, `כבר הגיע ל־${reason.agreed} המשמרות שבהסכם`, `Already at the agreed ${reason.agreed} shifts`, `Уже набранные ${reason.agreed} смен по соглашению`);
    case "shift_length":
      return tx(lang, `המשמרת ארוכה מ־${reason.cap} שעות`, `Longer than the ${reason.cap}h limit`, `Смена длиннее предела в ${reason.cap} ч`);
    case "home_schedule":
      return tx(lang, "הסידור באתר הראשי עוד לא מוכן", "The home site's week is not ready to publish", "График основного объекта ещё не готов к публикации");
    case "shabbat":
      return tx(
        lang,
        "שומר שבת: אין שיבוץ מיום שישי ב-15:00 עד מוצאי שבת ב-21:00",
        "Observes Shabbat: no shift from Friday 15:00 until Saturday 21:00",
        "Соблюдает шабат: нет смены с пятницы 15:00 до субботы 21:00",
      );
    case "holiday":
      return tx(
        lang,
        "שומר חג: אין שיבוץ מ-15:00 בערב החג עד 21:00 במוצאי החג",
        "Observes the festival: no shift from 15:00 the day before until 21:00 on the festival day",
        "Соблюдает праздник: нет смены с 15:00 накануне до 21:00 в день праздника",
      );
    case "consecutive_days": {
      const span = `${dotDate(reason.from)}–${dotDate(reason.to)}`;
      return tx(
        lang,
        `${reason.days} ימים ברצף (${span}). אסור לעבוד שבעה ימים ברצף`,
        `${reason.days} days in a row (${span}). Seven days in a row is not allowed`,
        `${reason.days} дней подряд (${span}). Семь дней подряд работать нельзя`,
      );
    }
  }
}

function dotDate(iso: string): string {
  const [, month, date] = iso.split("-");
  return `${Number(date)}.${Number(month)}`;
}

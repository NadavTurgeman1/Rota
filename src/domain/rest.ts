import { HebrewCalendar, flags } from "@hebcal/core";
import { addDays, durationHours, parseClock } from "./time";
import type { Employee, ShiftDefinition } from "./types";

/**
 * A fixed clock window for Shabbat and for festival days Israel keeps like Shabbat.
 * Candle-lighting moves through the year, and the Hours of Work and Rest Law
 * does not publish a clock time. 15:00 is before the earliest candle-lighting
 * in Israel, and 21:00 is after the latest end of Shabbat.
 */
export const REST_START_HOUR = 15;
export const REST_END_HOUR = 21;

const yomTov = new Map<string, boolean>();

function localDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Rosh Hashanah, Yom Kippur, and the festival days Israel keeps like Shabbat. Chol HaMoed is not included. */
export function isYomTov(iso: string): boolean {
  const cached = yomTov.get(iso);
  if (cached !== undefined) return cached;
  const events = HebrewCalendar.calendar({
    start: localDate(iso),
    end: localDate(iso),
    il: true,
    noRoshChodesh: true,
    noSpecialShabbat: true,
  });
  const rest = events.some((event) => (event.getFlags() & flags.CHAG) !== 0);
  yomTov.set(iso, rest);
  return rest;
}

/** Headcount for one day of `week`. A festival day uses Saturday's number. */
export function staffedCount(shift: Pick<ShiftDefinition, "req">, day: number, week: string): number {
  const index = isYomTov(addDays(week, day)) ? 6 : day;
  const count = Number(shift.req[index] || 0);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.trunc(count);
}

/** True when the board shows Saturday's staffing because the day is a festival. */
export function usesShabbatStaffing(week: string, day: number): boolean {
  return day !== 6 && isYomTov(addDays(week, day));
}

function span(day: number, shift: { start: string; end: string }): { start: number; end: number } {
  const start = day * 24 + parseClock(shift.start);
  return { start, end: start + durationHours(shift.start, shift.end) };
}

function overlaps(shift: { start: number; end: number }, window: { start: number; end: number }): boolean {
  return shift.start < window.end && shift.end > window.start;
}

function holidayWindows(week: string): { start: number; end: number }[] {
  const windows: { start: number; end: number }[] = [];
  for (let day = 0; day <= 7; day += 1) {
    if (!isYomTov(addDays(week, day))) continue;
    windows.push({ start: (day - 1) * 24 + REST_START_HOUR, end: day * 24 + REST_END_HOUR });
  }
  return windows;
}

const SHABBAT_WINDOW = { start: 5 * 24 + REST_START_HOUR, end: 6 * 24 + REST_END_HOUR };

/** Standing agreement lock. Follows the shift clocks, and does not depend on the week. */
export function shabbatBlocks(
  employee: Pick<Employee, "observesShabbat">,
  shift: { start: string; end: string },
  day: number,
): boolean {
  return employee.observesShabbat === true && overlaps(span(day, shift), SHABBAT_WINDOW);
}

/** Why this shift is closed for the person, or null when it can be worked. */
export function shiftRest(
  employee: Pick<Employee, "observesShabbat" | "observesHolidays">,
  shift: { start: string; end: string },
  day: number,
  week: string,
): "shabbat" | "holiday" | null {
  if (shabbatBlocks(employee, shift, day)) return "shabbat";
  if (employee.observesShabbat === true && employee.observesHolidays === true) {
    if (holidayWindows(week).some((window) => overlaps(span(day, shift), window))) return "holiday";
  }
  return null;
}

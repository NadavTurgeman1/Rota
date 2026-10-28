import type { Lang } from "../domain/rules";
import { dayName } from "../domain/rules";
import { addDays, sundayOnOrBefore } from "../domain/time";
import type { Business } from "../domain/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function jerusalemParts(now: Date): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return { day: WEEKDAYS.indexOf(weekday), minute: hour * 60 + minute };
}

function stamp(day: number, clock: string): number {
  return day * 1440 + minutes(clock);
}

/** Sets or clears the extra submission deadline. The same business comes back when nothing changes. */
export function withConstraintExtension(biz: Business, until: string | null): Business {
  if (until) {
    if (biz.constraintExtensionUntil === until) return biz;
    return { ...biz, constraintExtensionUntil: until };
  }
  if (!biz.constraintExtensionUntil) return biz;
  const next = { ...biz };
  delete next.constraintExtensionUntil;
  return next;
}

/** The extra window is open until its deadline, and not at the deadline itself. */
export function extensionStillOpen(until: string | undefined, now = new Date()): boolean {
  if (!until) return false;
  const time = Date.parse(until);
  return Number.isFinite(time) && time > now.getTime();
}

/** Employees may send a constraint request from the start day and hour through the end day and hour. */
export function constraintWindowOpen(biz: Business, now = new Date()): boolean {
  if (biz.staffAccess === false) return false;
  if (extensionStillOpen(biz.constraintExtensionUntil, now)) return true;
  const { day, minute } = jerusalemParts(now);
  if (day < 0) return false;
  const start = stamp(biz.constraintStartDay ?? 0, biz.constraintOpens ?? "00:00");
  const end = stamp(biz.constraintEndDay ?? 6, biz.constraintCloses ?? "23:59");
  const current = day * 1440 + minute;
  if (end >= start) return current >= start && current <= end;
  return current >= start || current <= end;
}

function jerusalemToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Sunday of the week that contains today in Jerusalem. That week is already underway. */
export function underwayWeek(now = new Date()): string {
  return sundayOnOrBefore(jerusalemToday(now));
}

/**
 * The only week an employee may submit constraints for.
 * The week already underway is closed, and so is any week further out.
 * Kept in step with the Jerusalem Sunday query in submitAvailabilityRequest.
 */
export function staffConstraintWeek(now = new Date()): string {
  return addDays(underwayWeek(now), 7);
}

export function staffCanSubmitConstraints(week: string, now = new Date()): boolean {
  return week === staffConstraintWeek(now);
}

export function constraintWindowText(biz: Business, lang: Lang): string {
  const opens = `${dayName(biz.constraintStartDay ?? 0, lang)} ${biz.constraintOpens ?? "00:00"}`;
  const closes = `${dayName(biz.constraintEndDay ?? 6, lang)} ${biz.constraintCloses ?? "23:59"}`;
  return `${opens} – ${closes}`;
}

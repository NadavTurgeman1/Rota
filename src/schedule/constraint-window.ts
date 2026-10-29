import type { Lang } from "../domain/rules";
import { dayName } from "../domain/rules";
import { addDays, sundayOnOrBefore } from "../domain/time";
import type { Business, RotaState } from "../domain/types";

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

/**
 * Drops an expired extra window and the exception toggles once nothing is open.
 * A permanent window that is open, or still scheduled for later, stays as it is.
 */
export function settleClosedConstraintWindow(state: RotaState, now = new Date()): RotaState {
  if (constraintWindowOpen(state.biz, now)) return state;
  const biz = withConstraintExtension(state.biz, null);
  if (biz === state.biz && !state.constraintGrants) return state;
  const next: RotaState = { ...state, biz };
  delete next.constraintGrants;
  return next;
}

/** Closes the extra window. The permanent window is left untouched, including when it has not started. */
export function closeExtraSubmissionWindow(state: RotaState, now = new Date()): RotaState {
  const biz = withConstraintExtension(state.biz, null);
  return settleClosedConstraintWindow(biz === state.biz ? state : { ...state, biz }, now);
}

/** The extra window is open until its deadline, and not at the deadline itself. */
export function extensionStillOpen(until: string | undefined, now = new Date()): boolean {
  if (!until) return false;
  const time = Date.parse(until);
  return Number.isFinite(time) && time > now.getTime();
}

const WEEK_MINUTES = 7 * 1440;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function jerusalemClock(now: Date): { day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  if (hour === 24) hour = 0;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const second = Number(parts.find((part) => part.type === "second")?.value ?? "0");
  return { day: WEEKDAYS.indexOf(weekday), hour, minute, second };
}

/** UTC instant for a Jerusalem clock time. */
function atJerusalem(iso: string, hour: number, minute: number): Date {
  const desired = `${iso}T${pad(hour)}:${pad(minute)}:00`;
  let utc = Date.parse(`${desired}Z`);
  for (let pass = 0; pass < 3; pass += 1) {
    const at = new Date(utc);
    const clock = jerusalemClock(at);
    const seen = `${jerusalemToday(at)}T${pad(clock.hour)}:${pad(clock.minute)}:00`;
    const delta = Date.parse(`${seen}Z`) - Date.parse(`${desired}Z`);
    if (delta === 0) break;
    utc -= delta;
  }
  return new Date(utc);
}

function nextWeekMinute(now: Date, weekMinute: number): Date {
  const sunday = underwayWeek(now);
  const day = Math.floor(weekMinute / 1440);
  const minuteOfDay = weekMinute % 1440;
  let at = atJerusalem(addDays(sunday, day), Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  if (at.getTime() <= now.getTime()) {
    at = atJerusalem(addDays(sunday, day + 7), Math.floor(minuteOfDay / 60), minuteOfDay % 60);
  }
  return at;
}

/**
 * How long until the submission window opens or closes.
 * The permanent window is included. A week that never closes has no such moment.
 */
export function millisUntilConstraintWindowChange(biz: Business, now = new Date()): number | null {
  if (biz.staffAccess === false) return null;
  const open = constraintWindowOpen(biz, now);
  const start = stamp(biz.constraintStartDay ?? 0, biz.constraintOpens ?? "00:00");
  const end = stamp(biz.constraintEndDay ?? 6, biz.constraintCloses ?? "23:59");
  const times = [nextWeekMinute(now, start), nextWeekMinute(now, (end + 1) % WEEK_MINUTES)];
  const extension = biz.constraintExtensionUntil ? Date.parse(biz.constraintExtensionUntil) : Number.NaN;
  if (Number.isFinite(extension) && extension > now.getTime()) times.push(new Date(extension));
  times.sort((left, right) => left.getTime() - right.getTime());
  for (const at of times) {
    if (at.getTime() <= now.getTime()) continue;
    if (constraintWindowOpen(biz, at) !== open) return at.getTime() - now.getTime();
  }
  return null;
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

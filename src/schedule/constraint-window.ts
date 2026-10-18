import type { Lang } from "../domain/rules";
import { dayName } from "../domain/rules";
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

/** Employees may send a constraint request from the start day and hour through the end day and hour. */
export function constraintWindowOpen(biz: Business, now = new Date()): boolean {
  if (biz.staffAccess === false) return false;
  const { day, minute } = jerusalemParts(now);
  if (day < 0) return false;
  const start = stamp(biz.constraintStartDay ?? 0, biz.constraintOpens ?? "00:00");
  const end = stamp(biz.constraintEndDay ?? 6, biz.constraintCloses ?? "23:59");
  const current = day * 1440 + minute;
  if (end >= start) return current >= start && current <= end;
  return current >= start || current <= end;
}

export function constraintWindowText(biz: Business, lang: Lang): string {
  const opens = `${dayName(biz.constraintStartDay ?? 0, lang)} ${biz.constraintOpens ?? "00:00"}`;
  const closes = `${dayName(biz.constraintEndDay ?? 6, lang)} ${biz.constraintCloses ?? "23:59"}`;
  return `${opens} – ${closes}`;
}

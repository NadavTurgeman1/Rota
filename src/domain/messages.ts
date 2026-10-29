import { addDays } from "./time";

/** Minutes east of UTC for `timeZone` at `at`. */
function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const as = (zone: string) => new Date(at.toLocaleString("en-US", { timeZone: zone, hourCycle: "h23" }));
  return Math.round((as(timeZone).getTime() - as("UTC").getTime()) / 60_000);
}

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Instant for a wall clock on `date` in `timeZone`. */
export function wallInstant(date: string, clock: string, timeZone: string): string {
  const time = clock.slice(0, 5);
  if (!DAY.test(date) || !CLOCK.test(time) || !timeZone) throw new Error("when");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hours, minutes, 0);
  let utc = wall;
  for (let step = 0; step < 3; step += 1) {
    utc = wall - zoneOffsetMinutes(timeZone, new Date(utc)) * 60_000;
  }
  return new Date(utc).toISOString();
}

/** When a shift begins on that weekday of `week`, in the site timezone. */
export function shiftDueAt(week: string, weekday: number, start: string, timeZone: string): string {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error("when");
  return wallInstant(addDays(week, weekday), start, timeZone);
}

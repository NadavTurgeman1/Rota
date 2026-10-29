/** Calendar-date arithmetic on `YYYY-MM-DD` keys. No local timezone. */

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** Sunday of the week that contains `isoDate`. Weeks start on Sunday. */
export function sundayOnOrBefore(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got ${isoDate}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) throw new Error(`Expected YYYY-MM-DD, got ${isoDate}`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

export function parseClock(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours + minutes / 60;
}

/** `HH:mm` for an hour on the Sunday-based clock. Minutes round to the nearest minute. */
export function formatClock(hour: number): string {
  const wrapped = ((hour % 24) + 24) % 24;
  const hours = Math.floor(wrapped + 1e-9);
  const minutes = Math.round((wrapped - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Place a clock time on the day nearest `anchor`. `anchor` is hours from Sunday 00:00. */
export function clockNear(anchor: number, value: string): number {
  const clock = parseClock(value);
  if (!Number.isFinite(clock)) return anchor;
  const dayBase = Math.floor(anchor / 24) * 24;
  let best = dayBase + clock;
  for (const candidate of [dayBase - 24 + clock, dayBase + clock, dayBase + 24 + clock]) {
    if (Math.abs(candidate - anchor) < Math.abs(best - anchor)) best = candidate;
  }
  return best;
}

/** Overnight shifts (end <= start) roll past midnight. A zero-length clock span is 24h. */
export function durationHours(start: string, end: string): number {
  const length = (parseClock(end) - parseClock(start) + 24) % 24;
  return length || 24;
}

export function shiftKind(start: string, end: string): "m" | "a" | "n" {
  const startHour = parseClock(start);
  if (parseClock(end) <= startHour || startHour >= 20 || startHour < 4) return "n";
  return startHour < 12 ? "m" : "a";
}

export function gapBetween(
  left: { start: number; end: number },
  right: { start: number; end: number },
): number {
  if (left.start >= right.end) return left.start - right.end;
  if (right.start >= left.end) return right.start - left.end;
  return -1;
}

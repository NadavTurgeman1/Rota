/** A phone clock may disagree with the server by less than this and still be accepted. */
export const CLOCK_SKEW_MS = 90_000;

/** Accept at once when the phone reports a radius this tight. */
export const TARGET_ACCURACY_METERS = 8;

/** Refuse a punch wider than this. A stable reading between the target and this is kept. */
export const MAX_ACCURACY_METERS = 100;

/** How long to keep listening for a tighter GPS lock before saving the best reading. */
export const GPS_SETTLE_MS = 10_000;

/** Hard stop while waiting for any reading. */
export const GPS_WAIT_MS = 20_000;

/** Minutes east of UTC for `timeZone` at `at`. */
export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const format = (zone: string) =>
    new Date(at.toLocaleString("en-US", { timeZone: zone, hourCycle: "h23" }));
  return Math.round((format(timeZone).getTime() - format("UTC").getTime()) / 60_000);
}

/** Minutes east of UTC reported by this device clock. */
export function deviceOffsetMinutes(at: Date): number {
  return -at.getTimezoneOffset();
}

/**
 * `skew` means the phone's instant is not the server's instant.
 * `timezone` means the phone's zone is not the site's zone, so the displayed hour would be wrong.
 */
export function clockProblem(input: { deviceNow: Date; serverNow: Date; timeZone: string }): "skew" | "timezone" | null {
  if (Math.abs(input.deviceNow.getTime() - input.serverNow.getTime()) > CLOCK_SKEW_MS) return "skew";
  if (deviceOffsetMinutes(input.deviceNow) !== zoneOffsetMinutes(input.timeZone, input.deviceNow)) return "timezone";
  return null;
}

import { describe, expect, it } from "vitest";
import { clockProblem, zoneOffsetMinutes } from "./clock";

describe("phone clock check", () => {
  it("knows Israel winter and summer offsets", () => {
    expect(zoneOffsetMinutes("Asia/Jerusalem", new Date("2026-01-15T12:00:00Z"))).toBe(120);
    expect(zoneOffsetMinutes("Asia/Jerusalem", new Date("2026-07-15T12:00:00Z"))).toBe(180);
    expect(zoneOffsetMinutes("Asia/Jerusalem", new Date("2026-10-27T06:00:00Z"))).toBe(120);
  });

  it("accepts a phone that matches the server and the site zone", () => {
    const serverNow = new Date("2026-10-27T06:00:00Z");
    const deviceNow = new Date(serverNow.getTime() + 2_000);
    const timeZone = "UTC";
    const zoned = new Date(deviceNow.getTime() - deviceNow.getTimezoneOffset() * 60_000);
    expect(clockProblem({ deviceNow, serverNow, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })).toBeNull();
    expect(zoned).toBeInstanceOf(Date);
    expect(clockProblem({ deviceNow, serverNow, timeZone })).toBe(deviceNow.getTimezoneOffset() === 0 ? null : "timezone");
  });

  it("rejects a phone set minutes off, or set to another zone", () => {
    const serverNow = new Date();
    expect(clockProblem({ deviceNow: new Date(serverNow.getTime() + 10 * 60_000), serverNow, timeZone: "UTC" })).toBe("skew");
    const deviceNow = new Date(serverNow.getTime());
    const here = deviceNow.getTimezoneOffset();
    const other = here === 0 ? "Asia/Jerusalem" : "UTC";
    expect(clockProblem({ deviceNow, serverNow, timeZone: other })).toBe("timezone");
  });
});

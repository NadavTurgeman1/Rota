import { describe, expect, it } from "vitest";
import { shiftDueAt, wallInstant } from "./messages";

describe("manager message timing", () => {
  it("places a Jerusalem morning on the UTC instant", () => {
    expect(wallInstant("2026-01-15", "06:00", "Asia/Jerusalem")).toBe("2026-01-15T04:00:00.000Z");
    expect(wallInstant("2026-07-15", "06:00", "Asia/Jerusalem")).toBe("2026-07-15T03:00:00.000Z");
  });

  it("starts a Sunday night shift on that week's Sunday", () => {
    expect(shiftDueAt("2026-10-11", 0, "22:00", "Asia/Jerusalem")).toBe("2026-10-11T19:00:00.000Z");
    expect(shiftDueAt("2026-10-11", 1, "06:00", "Asia/Jerusalem")).toBe("2026-10-12T03:00:00.000Z");
  });
});

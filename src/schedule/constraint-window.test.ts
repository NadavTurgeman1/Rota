import { describe, expect, it } from "vitest";
import type { Business } from "../domain/types";
import { constraintWindowOpen, constraintWindowText, staffCanSubmitConstraints, staffConstraintWeek, underwayWeek, withConstraintExtension } from "./constraint-window";

const site: Business = {
  name: "דרום",
  type: "security",
  minRest: 8,
  maxHours: 42,
  maxShift: 12,
  assume: true,
  shifts: [],
  staffAccess: true,
  constraintStartDay: 0,
  constraintEndDay: 0,
  constraintOpens: "09:00",
  constraintCloses: "12:00",
};

describe("constraint window", () => {
  it("opens from the start minute through the end minute on the chosen days", () => {
    expect(constraintWindowOpen(site, new Date("2026-10-18T07:00:00.000Z"))).toBe(true);
    expect(constraintWindowOpen(site, new Date("2026-10-18T09:00:00.000Z"))).toBe(true);
    expect(constraintWindowOpen(site, new Date("2026-10-18T09:01:00.000Z"))).toBe(false);
    expect(constraintWindowOpen(site, new Date("2026-10-18T05:00:00.000Z"))).toBe(false);
    expect(constraintWindowOpen(site, new Date("2026-10-19T07:00:00.000Z"))).toBe(false);
  });

  it("stays open across the week when the end is earlier than the start", () => {
    const span = { ...site, constraintStartDay: 4, constraintEndDay: 1, constraintOpens: "22:00", constraintCloses: "06:00" };
    expect(constraintWindowOpen(span, new Date("2026-10-22T19:00:00.000Z"))).toBe(true);
    expect(constraintWindowOpen(span, new Date("2026-10-18T20:00:00.000Z"))).toBe(true);
    expect(constraintWindowOpen(span, new Date("2026-10-19T02:00:00.000Z"))).toBe(true);
    expect(constraintWindowOpen(span, new Date("2026-10-19T04:00:00.000Z"))).toBe(false);
    expect(constraintWindowOpen(span, new Date("2026-10-20T10:00:00.000Z"))).toBe(false);
  });

  it("stays closed when employees have no login", () => {
    expect(constraintWindowOpen({ ...site, staffAccess: false }, new Date("2026-10-18T07:00:00.000Z"))).toBe(false);
    expect(constraintWindowText(site, "he")).toBe("ראשון 09:00 – ראשון 12:00");
  });

  it("opens for every employee during an extra window", () => {
    const extra = { ...site, constraintExtensionUntil: "2026-10-19T12:00:00.000Z" };
    expect(constraintWindowOpen(extra, new Date("2026-10-19T11:59:00.000Z"))).toBe(true);
    expect(constraintWindowOpen(extra, new Date("2026-10-19T12:00:00.000Z"))).toBe(false);
    expect(constraintWindowOpen({ ...extra, staffAccess: false }, new Date("2026-10-19T11:00:00.000Z"))).toBe(false);
  });

  it("closes the extra window when the deadline is cleared", () => {
    const now = new Date("2026-10-19T11:00:00.000Z");
    const open = withConstraintExtension(site, "2026-10-19T12:00:00.000Z");
    expect(constraintWindowOpen(open, now)).toBe(true);
    const closed = withConstraintExtension(open, null);
    expect(closed.constraintExtensionUntil).toBeUndefined();
    expect(constraintWindowOpen(closed, now)).toBe(false);
    expect(withConstraintExtension(closed, null)).toBe(closed);
  });

  it("lets an employee submit constraints only for the week after the one underway", () => {
    const wednesday = new Date("2026-10-28T10:00:00.000Z");
    expect(underwayWeek(wednesday)).toBe("2026-10-25");
    expect(staffConstraintWeek(wednesday)).toBe("2026-11-01");
    expect(staffCanSubmitConstraints("2026-11-01", wednesday)).toBe(true);
    expect(staffCanSubmitConstraints("2026-10-25", wednesday)).toBe(false);
    expect(staffCanSubmitConstraints("2026-11-08", wednesday)).toBe(false);
    const sunday = new Date("2026-11-01T00:30:00.000Z");
    expect(underwayWeek(sunday)).toBe("2026-11-01");
    expect(staffConstraintWeek(sunday)).toBe("2026-11-08");
  });
});

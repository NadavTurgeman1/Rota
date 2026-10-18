import { describe, expect, it } from "vitest";
import type { Business } from "../domain/types";
import { constraintWindowOpen, constraintWindowText } from "./constraint-window";

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
});

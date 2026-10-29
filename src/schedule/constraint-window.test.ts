import { describe, expect, it } from "vitest";
import type { Business } from "../domain/types";
import { closeExtraSubmissionWindow, constraintWindowOpen, constraintWindowText, millisUntilConstraintWindowChange, settleClosedConstraintWindow, staffCanSubmitConstraints, staffConstraintWeek, underwayWeek, withConstraintExtension } from "./constraint-window";
import type { RotaState } from "../domain/types";

function roster(biz: Business, grants?: Record<string, string[]>): RotaState {
  return {
    week: "2026-10-18",
    biz,
    emps: [],
    avail: {},
    sched: {},
    closed: {},
    ...(grants ? { constraintGrants: grants } : {}),
  };
}

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

  it("turns exception toggles off when the permanent window reaches its close time", () => {
    const during = new Date("2026-10-18T07:00:00.000Z");
    const closesAt = new Date("2026-10-18T09:01:00.000Z");
    const open = roster(site, { "2026-10-25": ["dana"] });
    expect(millisUntilConstraintWindowChange(site, during)).toBe(closesAt.getTime() - during.getTime());
    expect(settleClosedConstraintWindow(open, closesAt).constraintGrants).toBeUndefined();
    expect(settleClosedConstraintWindow(open, closesAt).biz.constraintCloses).toBe("12:00");
    const before = new Date("2026-10-18T05:00:00.000Z");
    expect(millisUntilConstraintWindowChange(site, before)).toBe(new Date("2026-10-18T06:00:00.000Z").getTime() - before.getTime());
    const withExtra = { ...site, constraintExtensionUntil: "2026-10-18T10:00:00.000Z" };
    expect(millisUntilConstraintWindowChange(withExtra, new Date("2026-10-18T09:00:00.000Z"))).toBe(60 * 60 * 1000);
    expect(millisUntilConstraintWindowChange({ ...site, constraintStartDay: 0, constraintEndDay: 6, constraintOpens: "00:00", constraintCloses: "23:59" }, during)).toBeNull();
  });

  it("turns exception toggles off when the submission window closes", () => {
    const during = new Date("2026-10-18T07:00:00.000Z");
    const after = new Date("2026-10-18T09:01:00.000Z");
    const open = roster(site, { "2026-10-25": ["dana"] });
    expect(settleClosedConstraintWindow(open, during)).toBe(open);
    const closed = settleClosedConstraintWindow(open, after);
    expect(closed.constraintGrants).toBeUndefined();
    expect(closed.biz.constraintOpens).toBe("09:00");
    expect(closed.biz.constraintCloses).toBe("12:00");
    expect(settleClosedConstraintWindow(closed, after)).toBe(closed);
  });

  it("leaves the permanent window alone when an earlier extra window closes first", () => {
    const before = new Date("2026-10-18T05:30:00.000Z");
    const inside = new Date("2026-10-18T07:00:00.000Z");
    const early = roster(
      { ...site, constraintExtensionUntil: "2026-10-18T05:50:00.000Z" },
      { "2026-10-25": ["dana"] },
    );
    expect(constraintWindowOpen(early.biz, before)).toBe(true);
    const closed = closeExtraSubmissionWindow(early, before);
    expect(closed.biz.constraintExtensionUntil).toBeUndefined();
    expect(closed.constraintGrants).toBeUndefined();
    expect(closed.biz.constraintStartDay).toBe(0);
    expect(closed.biz.constraintEndDay).toBe(0);
    expect(closed.biz.constraintOpens).toBe("09:00");
    expect(closed.biz.constraintCloses).toBe("12:00");
    expect(constraintWindowOpen(closed.biz, before)).toBe(false);
    expect(constraintWindowOpen(closed.biz, inside)).toBe(true);
    const expired = settleClosedConstraintWindow(early, new Date("2026-10-18T05:55:00.000Z"));
    expect(expired.biz.constraintOpens).toBe("09:00");
    expect(expired.constraintGrants).toBeUndefined();
    expect(constraintWindowOpen(expired.biz, inside)).toBe(true);
  });

  it("keeps exception toggles when the extra window closes during the permanent window", () => {
    const during = new Date("2026-10-18T07:00:00.000Z");
    const open = roster(
      { ...site, constraintExtensionUntil: "2026-10-18T08:00:00.000Z" },
      { "2026-10-25": ["dana"] },
    );
    const closed = closeExtraSubmissionWindow(open, during);
    expect(closed.biz.constraintExtensionUntil).toBeUndefined();
    expect(closed.constraintGrants).toEqual({ "2026-10-25": ["dana"] });
    expect(constraintWindowOpen(closed.biz, during)).toBe(true);
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

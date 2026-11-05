import { describe, expect, it } from "vitest";
import { schedulingSavings } from "./roi";

describe("schedulingSavings", () => {
  it("scales weekly scheduling time with team size", () => {
    const base = {
      weeklyHours: 8,
      hourlyCost: 50,
      referenceEmployees: 10,
      weeksPerMonth: 4.3,
      savingsShare: 0.7,
    };
    expect(schedulingSavings({ ...base, employees: 10 }).monthly).toBeCloseTo(1204);
    expect(schedulingSavings({ ...base, employees: 20 }).monthly).toBeCloseTo(2408);
    expect(schedulingSavings({ ...base, employees: 10 }).yearly).toBeCloseTo(14448);
  });
});

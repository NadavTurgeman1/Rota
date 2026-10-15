import { describe, expect, it } from "vitest";
import { sentinelState } from "../demo/sentinel";
import { MANAGER, removeEmployeeRecord } from "../people/edit";
import { sampleInsights } from "./sample";

describe("sample insights", () => {
  it("is stable for the same week and uses the real roster", () => {
    const state = sentinelState("2026-10-11");
    const first = sampleInsights(state);
    expect(sampleInsights(state)).toEqual(first);
    expect(first.people.map((person) => person.name).sort()).toEqual(state.emps.map((employee) => employee.name).sort());
    expect(first.days).toHaveLength(7);
  });

  it("keeps every anomaly and tip consistent with the table", () => {
    for (const week of ["2026-10-11", "2026-10-18", "2026-10-25", "2026-11-01"]) {
      const data = sampleInsights(sentinelState(week));
      const busiest = data.people[0];
      const calmest = data.people[data.people.length - 1];
      expect(busiest.shifts).toBeGreaterThan(busiest.quota);
      expect(calmest.shifts).toBeLessThan(calmest.quota);
      expect(data.doubles).toBeGreaterThan(0);
      expect(data.tips.find((tip) => tip.kind === "reduceDoubles")?.value).toBe(data.doubles);
      expect(data.anomalies.find((item) => item.kind === "underUsed")?.name).toBe(calmest.name);
    }
  });

  it("never mentions an employee who was deleted, and has no people to show on an empty site", () => {
    const state = sentinelState("2026-10-11");
    const gone = state.emps[0];
    const after = removeEmployeeRecord(state, MANAGER, gone.id, state.week);
    expect(after.emps.some((employee) => employee.id === gone.id)).toBe(false);
    const data = sampleInsights(after);
    const text = JSON.stringify([data.people, data.anomalies, data.tips]);
    expect(text).not.toContain(gone.name);
    expect(data.people).toHaveLength(after.emps.length);

    const empty = sampleInsights({ ...state, emps: [] });
    expect(empty.people).toEqual([]);
    expect(empty.anomalies).toEqual([]);
    expect(empty.tips.every((tip) => tip.kind === "hireForDay")).toBe(true);

    const single = sampleInsights({ ...state, emps: state.emps.slice(0, 1) });
    expect(single.tips.every((tip) => tip.other === "")).toBe(true);
  });
});

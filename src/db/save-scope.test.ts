import { describe, expect, it } from "vitest";
import type { RotaState } from "../domain/types";
import { diffWorkspace, parseSaveScope } from "./save-scope";

const week = "2026-10-11";
const nextWeek = "2026-10-18";

function state(): RotaState {
  return {
    week,
    biz: {
      name: "מטה",
      type: "security",
      minRest: 8,
      maxHours: 40,
      maxShift: 8,
      assume: true,
      shifts: [{ id: "11111111-1111-4111-8111-111111111111", name: "בוקר", start: "06:00", end: "14:00", role: "", req: [1, 1, 1, 1, 1, 0, 0] }],
    },
    emps: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "דנה",
        contact: "",
        role: "",
        quals: "",
        perWeek: 5,
        maxHours: 0,
        pref: [],
        active: true,
      },
    ],
    avail: {},
    sched: { [week]: { assign: {}, locked: [], status: "draft" } },
    closed: {},
  };
}

function workspace(site = state()) {
  return {
    org: { name: "רוטה", type: "security", hebrewCalendar: true },
    sites: [{ id: "33333333-3333-4333-8333-333333333333", state: site }],
  };
}

describe("diffWorkspace", () => {
  it("ignores the open week and an unchanged company", () => {
    const before = workspace();
    const after = workspace({ ...state(), week: nextWeek });
    expect(diffWorkspace(before, after)).toBeNull();
  });

  it("writes a quota without touching the schedule", () => {
    const before = workspace();
    const edited = state();
    edited.emps = [{ ...edited.emps[0], perWeek: 3 }];
    const scope = diffWorkspace(before, workspace(edited));
    expect(scope).toEqual({
      org: false,
      sites: {
        "33333333-3333-4333-8333-333333333333": {
          biz: false,
          people: true,
          availability: false,
          notes: false,
          weeks: [],
          removedWeeks: [],
        },
      },
    });
  });

  it("writes only the week that changed, and every week when a shift is removed", () => {
    const before = workspace();
    const oneWeek = state();
    oneWeek.sched = {
      ...oneWeek.sched,
      [nextWeek]: { assign: {}, locked: [], status: "draft" },
    };
    expect(diffWorkspace(before, workspace(oneWeek))?.sites["33333333-3333-4333-8333-333333333333"].weeks).toEqual([nextWeek]);

    const removed = state();
    removed.biz = { ...removed.biz, shifts: [] };
    const scope = diffWorkspace(before, workspace(removed));
    expect(scope?.sites["33333333-3333-4333-8333-333333333333"].biz).toBe(true);
    expect(scope?.sites["33333333-3333-4333-8333-333333333333"].weeks).toEqual([week]);
  });
});

describe("parseSaveScope", () => {
  it("accepts a partial scope and rejects a broken one", () => {
    expect(parseSaveScope(undefined)).toBeUndefined();
    expect(
      parseSaveScope({
        org: false,
        sites: {
          "33333333-3333-4333-8333-333333333333": {
            biz: false,
            people: true,
            availability: false,
            notes: false,
            weeks: [week],
            removedWeeks: [],
          },
        },
      })?.org,
    ).toBe(false);
    expect(parseSaveScope({ org: false, sites: [] })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { addEmployee, generateWeek, publishCheck, reliefChoices } from "../schedule/edit";
import { analyze, ensureSchedule, slots } from "./index";
import type { Employee, PeerShift, RotaState } from "./types";

const week = "2026-10-18";

function person(homeSiteId?: string): Employee {
  return {
    id: "dana",
    name: "דנה",
    contact: "",
    phone: "0501111111",
    role: "",
    quals: "",
    perWeek: 1,
    maxHours: 0,
    pref: [],
    active: true,
    grid: [0, 1, 2, 3, 4, 5, 6].map(() => ["m"]),
    ...(homeSiteId ? { homeSiteId } : {}),
  };
}

function state(siteId: string, homeSiteId = siteId): RotaState {
  return {
    week,
    siteId,
    biz: {
      name: siteId,
      type: "Security company",
      minRest: 8,
      maxHours: 48,
      maxShift: 12,
      assume: true,
      shifts: [{ id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] }],
    },
    emps: [person(homeSiteId)],
    avail: {},
    sched: {},
    closed: {},
  };
}

describe("reinforcement staff", () => {
  it("fills the primary site and leaves the reinforcement site open", () => {
    expect(generateWeek(state("home")).sched[week]?.assign["0|m"]).toEqual(["dana"]);
    const away = generateWeek(state("away", "home"));
    expect(away.sched[week]?.assign["0|m"]).toEqual([]);
    expect(analyze(away, week).under).toEqual([]);
    expect(analyze(away, week).overQuota).toEqual([]);
    expect(analyze(away, week).unfilled).toHaveLength(1);
  });

  it("refuses a reinforcement seat until the primary week is ready to publish", () => {
    const away = state("away", "home");
    const held = { ...away, homeReady: { dana: false } };
    const slot = slots(held, week)[0];
    if (!slot) throw new Error("missing slot");
    expect(addEmployee(held, slot.key, "dana")).toBe(held);
    expect(reliefChoices(held, slot)).toEqual([{ employeeId: "dana", name: "דנה", held: true }]);

    const home = state("home");
    ensureSchedule(home, week).assign["0|m"] = ["dana"];
    expect(publishCheck(home).ready).toBe(true);
    expect(publishCheck(state("home")).ready).toBe(false);

    const ready = { ...away, homeReady: { dana: true } };
    expect(addEmployee(ready, slot.key, "dana").sched[week]?.assign[slot.key]).toEqual(["dana"]);
    expect(reliefChoices(ready, slot).map((choice) => choice.held)).toEqual([false]);
  });

  it("counts every site in the primary quota and ignores that quota on reinforcement", () => {
    const peer: PeerShift = {
      key: "away|0|0|m",
      day: 0,
      start: 30,
      end: 38,
      label: "away",
      minRest: 8,
      maxHours: 48,
      maxDayHours: 0,
      maxShift: 12,
      weekOffset: 0,
    };
    const home = state("home");
    ensureSchedule(home, week).assign["0|m"] = ["dana"];
    home.peers = { dana: [peer] };
    expect(analyze(home, week).overQuota).toHaveLength(1);

    const away = state("away", "home");
    ensureSchedule(away, week).assign["0|m"] = ["dana"];
    away.peers = { dana: [{ ...peer, key: "home|0|0|m" }] };
    expect(analyze(away, week).overQuota).toEqual([]);
    expect(analyze(away, week).under).toEqual([]);
  });
});

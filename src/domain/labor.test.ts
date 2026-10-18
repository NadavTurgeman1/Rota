import { describe, expect, it } from "vitest";
import { ensureSchedule, type Employee, type RotaState, type ShiftDefinition } from "./index";
import { laborNotes } from "./labor";
import { publishCheck } from "../schedule/edit";

const week = "2026-10-18";

const shifts: ShiftDefinition[] = [
  { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
  { id: "a", name: "Afternoon", start: "14:00", end: "22:00", role: "", req: [0, 0, 0, 0, 0, 0, 0] },
  { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
];

function person(id: string, name: string): Employee {
  return {
    id,
    name,
    contact: "",
    role: "מאבטח",
    quals: "",
    perWeek: 6,
    maxHours: 60,
    allowed: ["m", "a", "n"],
    blocked: [],
    pref: [],
    active: true,
  };
}

function stateWith(assign: Record<string, string[]>, extra: Partial<RotaState> = {}): RotaState {
  const state: RotaState = {
    week,
    biz: {
      name: "דרום",
      type: "security",
      minRest: 6,
      maxHours: 60,
      maxShift: 12,
      assume: true,
      shifts: shifts.map((shift) => ({ ...shift, req: [...shift.req] })),
    },
    emps: [person("dana", "דנה")],
    avail: {},
    sched: {},
    closed: {},
    ...extra,
  };
  const schedule = ensureSchedule(state, week);
  schedule.assign = assign;
  return state;
}

describe("Israeli employment-law notes", () => {
  it("notes a packed week and still allows publishing", () => {
    const assign: Record<string, string[]> = {};
    for (let day = 0; day < 7; day += 1) assign[`${day}|m`] = ["dana"];
    const state = stateWith(assign);
    const night = state.biz.shifts.find((shift) => shift.id === "n");
    if (night) night.req = [0, 0, 0, 0, 0, 0, 0];
    const notes = laborNotes(state, week, "he");
    expect(notes.some((note) => note.includes("42 שעות"))).toBe(true);
    expect(notes.some((note) => note.includes("36 שעות מנוחה"))).toBe(true);
    expect(publishCheck(state).ready).toBe(true);
  });

  it("notes a night longer than 7 hours, a short gap, and Friday over 7 hours", () => {
    const state = stateWith({
      "0|n": ["dana"],
      "1|m": ["dana"],
      "5|m": ["dana"],
    });
    const notes = laborNotes(state, week, "he").join("\n");
    expect(notes).toContain("משמרת לילה");
    expect(notes).toContain("פחות מ־8 שעות");
    expect(notes).toContain("יום שלפני המנוחה השבועית");
  });

  it("does not flag weekly rest when Saturday is free", () => {
    const assign: Record<string, string[]> = {};
    for (let day = 0; day < 6; day += 1) assign[`${day}|m`] = ["dana"];
    const notes = laborNotes(stateWith(assign), week, "he");
    expect(notes.some((note) => note.includes("36 שעות"))).toBe(false);
  });

  it("notes night work in two neighbouring weeks", () => {
    const state = stateWith({ "0|n": ["dana"] });
    ensureSchedule(state, "2026-10-11").assign = { "0|n": ["dana"] };
    expect(laborNotes(state, week, "he").some((note) => note.includes("שבוע סמוך"))).toBe(true);
  });
});

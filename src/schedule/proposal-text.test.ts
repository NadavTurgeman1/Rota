import { describe, expect, it } from "vitest";
import { ensureSchedule, slots, suggest, type Employee, type RotaState, type ShiftDefinition } from "../domain";
import { proposalsFor } from "./edit";
import { proposalText } from "./display";

const week = "2026-10-18";

const shifts: ShiftDefinition[] = [
  { id: "m", name: "Morning", start: "06:00", end: "14:00", role: "", req: [2, 0, 0, 0, 0, 0, 0] },
  { id: "a", name: "Afternoon", start: "14:00", end: "22:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
  { id: "n", name: "Night", start: "22:00", end: "06:00", role: "", req: [1, 0, 0, 0, 0, 0, 0] },
];

function person(id: string, name: string, perWeek = 4): Employee {
  return {
    id,
    name,
    contact: "",
    role: "מאבטח",
    quals: "",
    perWeek,
    maxHours: 0,
    allowed: ["m", "a", "n"],
    blocked: [],
    pref: [],
    active: true,
    hourlyWage: 50,
  };
}

function morningHole(): RotaState {
  const state: RotaState = {
    week,
    biz: {
      name: "דרום",
      type: "security",
      minRest: 8,
      maxHours: 42,
      maxShift: 12,
      assume: true,
      shifts,
    },
    emps: [person("dana", "דנה"), person("noa", "נועה"), person("eli", "אלי"), person("gal", "גל", 3)],
    avail: {},
    sched: {},
    closed: {},
  };
  const schedule = ensureSchedule(state, week);
  schedule.assign = { "0|m": ["dana"], "0|a": ["noa"], "0|n": ["eli"] };
  return state;
}

describe("hole suggestions", () => {
  it("offers an extra shift before a double, and names every move and extension", () => {
    const state = morningHole();
    const morning = slots(state, week).find((slot) => slot.key === "0|m")!;
    const proposals = proposalsFor(state, morning);
    const kinds = proposals.map((proposal) => proposal.kind);
    expect(kinds[0]).toBe("extra");
    expect(kinds.indexOf("coverage")).toBeGreaterThan(kinds.lastIndexOf("extra"));

    const option = suggest(state, week, morning)[0];
    expect(option).toBeTruthy();
    const text = proposalText({ kind: "coverage", option: option! }, "he", state);
    const mover = option!.parts.find((part) => part.from.endsWith("|a") && part.slotKey.endsWith("|m"));
    expect(mover?.name).toBeTruthy();
    expect(text).toContain(`${mover!.name} — מעבר מצהריים לבוקר`);
    for (const part of option!.parts.filter((item) => item.extended && item.from === item.slotKey)) {
      const shift = part.slotKey.endsWith("|m") ? "בוקר" : part.slotKey.endsWith("|n") ? "לילה" : "צהריים";
      expect(text).toContain(`${part.name} — הארכה לכפולה ב${shift}`);
    }
    expect(text.indexOf("מעבר")).toBeLessThan(text.indexOf("הארכה לכפולה"));
    expect(text).not.toContain("גל");
    expect(proposalText(proposals[0]!, "he", state)).toContain("גל: משמרת נוספת");
  });
});

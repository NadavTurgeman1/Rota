import { describe, expect, it } from "vitest";
import { ensureSchedule, slots, suggestExtra, type Employee, type RotaState, type ShiftDefinition } from "./index";
import { proposalText } from "../schedule/display";

const week = "2026-10-04";
const morning: ShiftDefinition = { id: "m", name: "Morning", start: "07:00", end: "15:00", role: "", req: [1, 1, 0, 0, 0, 0, 0] };

function person(id: string, name: string, wage: number): Employee {
  return {
    id,
    name,
    contact: "",
    role: "Guard",
    quals: "",
    perWeek: 1,
    maxHours: 0,
    hourlyWage: wage,
    allowed: ["m"],
    blocked: [],
    pref: [],
    active: true,
  };
}

describe("hole suggestions keep every wage", () => {
  it("lists the cheaper person first and still offers the dearer one", () => {
    const state: RotaState = {
      week,
      biz: { name: "דרום", type: "security", minRest: 8, maxHours: 42, maxShift: 12, assume: true, shifts: [morning] },
      emps: [person("dear", "מתגבר", 60), person("unset", "בלי שכר", 0), person("cheap", "עובד", 51)],
      avail: {},
      sched: {},
      closed: {},
    };
    const schedule = ensureSchedule(state, week);
    schedule.assign = { "0|m": ["cheap", "dear", "unset"] };
    const monday = slots(state, week).find((slot) => slot.key === "1|m");
    if (!monday) throw new Error("slot");
    const options = suggestExtra(state, week, monday);
    expect(options.map((option) => option.name)).toEqual(["עובד", "מתגבר", "בלי שכר"]);
    expect(options[1]?.dearerThan).toBe(51);
    expect(proposalText({ kind: "extra", option: options[1]! }, "he")).toContain("60 ₪ לשעה");
    expect(proposalText({ kind: "extra", option: options[1]! }, "he")).toContain("יקר יותר מ־51 ₪");
    expect(proposalText({ kind: "extra", option: options[2]! }, "he")).toContain("שכר לא הוגדר");
  });
});

import { describe, expect, it } from "vitest";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import type { Employee, RotaState, ShiftDefinition } from "../domain";
import { applyConstraintText, MANAGER, setAvailability } from "../people/edit";
import { generateWeek } from "../schedule/edit";
import { copy } from "../i18n/copy";
import { parseConstraints } from "./parse";

const week = "2026-10-11";
const { morning, afternoon, night } = SENTINEL;

function guard(id: string, name: string, shifts: string[] = [morning, afternoon, night]): Employee {
  return {
    id,
    name,
    contact: "",
    role: "Guard",
    quals: "",
    perWeek: 5,
    maxHours: 0,
    pref: [],
    active: true,
    grid: [0, 1, 2, 3, 4, 5, 6].map(() => [...shifts]),
  };
}

function withPeople(people: Employee[], shifts?: ShiftDefinition[]): RotaState {
  const state = sentinelState(week);
  state.emps = people;
  if (shifts) state.biz.shifts = shifts;
  return state;
}

function shift(id: string, name: string, start: string, end: string): ShiftDefinition {
  return { id, name, start, end, role: "", req: [1, 1, 1, 1, 1, 1, 1] };
}

const ben = guard("ben", "בן נתנוב");

describe("parseConstraints", () => {
  it("turns the Ben Natanov note into Sunday morning off and Tuesday night off", () => {
    const state = withPeople([ben]);
    const draft = parseConstraints("בן נתנוב\nראשון - לא עובד בוקר\nשלישי - לא עובד לילה", state);
    expect(draft.lines.map((line) => line.status)).toEqual(["recognized", "recognized", "recognized"]);
    const row = draft.proposals.ben;
    expect(row[0]).toEqual([afternoon, night]);
    expect(row[2]).toEqual([morning, afternoon]);
    expect(row[1]).toEqual([morning, afternoon, night]);
    expect(state.avail[week]?.ben).toBeUndefined();
    expect(ben.grid?.[0]).toContain(morning);
  });

  it("matches spacing, nikud, final letters, and English day and shift names", () => {
    const state = withPeople([ben, guard("latin", "Ben Natanov")]);
    const hebrew = parseConstraints("ב\u05BC\u05B5\u05DF  נתנוב\nיום א׳ - לא יכול בוקר", state);
    expect(hebrew.lines[1]).toMatchObject({ status: "recognized", employeeId: "ben", days: [0], shiftIds: [morning], polarity: "off" });

    const english = parseConstraints("ben   natanov\nSun - unavailable morning\nTue - can't work night", state);
    expect(english.proposals.latin[0]).toEqual([afternoon, night]);
    expect(english.proposals.latin[2]).toEqual([morning, afternoon]);
    expect(english.lines.every((line) => line.status === "recognized")).toBe(true);
  });

  it("reads only-morning, evening, and a second employee in the same paste", () => {
    const dana = guard("dana", "Dana", [morning, afternoon]);
    const yossi = guard("yossi", "Yossi");
    const state = withPeople([ben, dana, yossi]);
    state.avail[week] = {
      yossi: [0, 1, 2, 3, 4, 5, 6].map((day) => (day === 4 ? [morning] : [morning, afternoon, night])),
    };
    const draft = parseConstraints(
      "בן נתנוב\nשני - רק בוקר\n\nYossi\nThursday - can work evening\n\nDana\nSunday - not working morning",
      state,
    );
    expect(draft.proposals.ben[1]).toEqual([morning]);
    expect(draft.proposals.yossi[4]).toEqual([morning, afternoon]);
    expect(draft.proposals.dana[0]).toEqual([afternoon]);
    expect(draft.lines.find((line) => line.raw.startsWith("Thursday"))).toMatchObject({ status: "recognized", polarity: "on" });
  });

  it("understands a custom shift name and leaves a shared time-of-day word ambiguous", () => {
    const patrol = "patrol";
    const state = withPeople(
      [ben],
      [shift(morning, "Morning", "06:00", "14:00"), shift(patrol, "סיור", "15:00", "19:00"), shift(night, "Night", "22:00", "06:00")],
    );
    const named = parseConstraints("בן נתנוב\nראשון - לא עובד סיור", state);
    expect(named.proposals.ben[0]).toEqual([morning, night]);

    const shared = withPeople(
      [ben],
      [shift(morning, "Morning", "06:00", "14:00"), shift(patrol, "Patrol", "07:00", "11:00")],
    );
    const ambiguous = parseConstraints("בן נתנוב\nראשון - לא עובד בוקר", shared);
    expect(ambiguous.lines[1]).toMatchObject({ status: "ambiguous", reason: "ambiguous_shift" });
    expect(ambiguous.proposals).toEqual({});
  });

  it("keeps an unknown name and an ambiguous line out of the draft", () => {
    const twin = guard("twin", "בן נתנוב");
    const state = withPeople([ben, twin, guard("yossi", "Yossi")]);
    const unknown = parseConstraints("משה כהן\nראשון - לא עובד בוקר\n???", state);
    expect(unknown.lines.map((line) => [line.status, line.reason])).toEqual([
      ["unparsed", "unknown_employee"],
      ["ambiguous", "no_employee"],
      ["unparsed", undefined],
    ]);
    expect(unknown.proposals).toEqual({});

    const vague = parseConstraints("Yossi\nראשון בוקר\nשלישי - לא עובד לילה אבל חמישי כן", state);
    expect(vague.lines[1]).toMatchObject({ status: "ambiguous", reason: "missing_polarity" });
    expect(vague.lines[2]).toMatchObject({ status: "ambiguous", reason: "conflict" });
    expect(vague.proposals).toEqual({});

    const sameName = parseConstraints("בן נתנוב\nראשון - לא עובד בוקר", state);
    expect(sameName.lines[0]).toMatchObject({ status: "ambiguous", reason: "ambiguous_employee" });
    expect(sameName.proposals).toEqual({});
  });

  it("applies several days, a whole week, and does not turn a failed line into full availability", () => {
    const state = withPeople([ben]);
    const draft = parseConstraints("בן נתנוב\nראשון ושלישי - לא עובד בוקר\nכל השבוע - לא עובד לילה\nמחר אולי", state);
    expect(draft.proposals.ben[0]).toEqual([afternoon]);
    expect(draft.proposals.ben[2]).toEqual([afternoon]);
    expect(draft.proposals.ben[1]).toEqual([morning, afternoon]);
    expect(draft.lines.at(-1)).toMatchObject({ status: "unparsed", reason: "unknown_employee" });
    expect(draft.proposals.ben[3]).not.toEqual([]);
  });
});

describe("day ranges and exceptions", () => {
  const state = withPeople([ben, guard("dana", "Dana")]);
  const all = [morning, afternoon, night];
  const offDays = (text: string, employeeId = "ben") => {
    const draft = parseConstraints(text, state);
    const line = draft.lines.at(-1)!;
    expect(line.status, `${text}: ${line.reason}`).toBe("recognized");
    const row = draft.proposals[employeeId];
    return [0, 1, 2, 3, 4, 5, 6].filter((day) => row[day].length === 0);
  };

  it.each([
    ["בן נתנוב לא עובד מיום ראשון עד יום רביעי", [0, 1, 2, 3]],
    ["בן נתנוב לא עובד מראשון עד רביעי", [0, 1, 2, 3]],
    ["בן נתנוב לא עובד מראשון ועד רביעי כולל", [0, 1, 2, 3]],
    ["בן נתנוב לא עובד מראשון עד רביעי לא כולל", [0, 1, 2]],
    ["בן נתנוב לא עובד ראשון-רביעי", [0, 1, 2, 3]],
    ["בן נתנוב לא עובד א׳–ד׳", [0, 1, 2, 3]],
    ["בן נתנוב לא יכול בין שני לחמישי", [1, 2, 3, 4]],
    ["בן נתנוב לא זמין עד רביעי", [0, 1, 2, 3]],
    ["בן נתנוב לא זמין מרביעי והלאה", [3, 4, 5, 6]],
    ["בן נתנוב לא עובד מחמישי עד ראשון", [0, 4, 5, 6]],
  ])("%s", (text, days) => {
    expect(offDays(text)).toEqual(days);
  });

  it.each([
    ["Dana not available Monday to Thursday", [1, 2, 3, 4]],
    ["Dana unavailable sun-wed", [0, 1, 2, 3]],
    ["Dana can't work from Tuesday until Friday", [2, 3, 4, 5]],
    ["Dana available all week except Friday", [5]],
  ])("%s", (text, days) => {
    expect(offDays(text, "dana")).toEqual(days);
  });

  it.each([
    ["בן נתנוב פנוי כל השבוע חוץ משישי", [5]],
    ["בן נתנוב פנוי כל השבוע בלי שישי ושבת", [5, 6]],
    ["בן נתנוב יכול כל הימים מלבד שלישי", [2]],
    ["בן נתנוב לא עובד כל השבוע חוץ משלישי", [0, 1, 3, 4, 5, 6]],
    ["בן נתנוב לא עובד מראשון עד חמישי פרט לשלישי", [0, 1, 3, 4]],
    ["בן נתנוב זמין כל השבוע לא כולל שבת", [6]],
  ])("%s", (text, days) => {
    expect(offDays(text)).toEqual(days);
  });

  it("keeps a range limited to the named shift", () => {
    const draft = parseConstraints("בן נתנוב לא עובד לילה מראשון עד שלישי", state);
    expect(draft.proposals.ben.slice(0, 4)).toEqual([[morning, afternoon], [morning, afternoon], [morning, afternoon], all]);
  });

  it("still reads בלי without a day as not available", () => {
    const draft = parseConstraints("בן נתנוב\nשני - בלי לילה", state);
    expect(draft.lines[1]).toMatchObject({ status: "recognized", polarity: "off", days: [1], shiftIds: [night] });
  });

  it("leaves a dangling range and a real contradiction ambiguous", () => {
    expect(parseConstraints("בן נתנוב לא עובד מראשון עד", state).lines[0]).toMatchObject({ status: "ambiguous" });
    expect(parseConstraints("בן נתנוב לא עובד ראשון אבל שני כן", state).lines[0]).toMatchObject({ status: "ambiguous", reason: "conflict" });
  });
});

describe("the example in the message box", () => {
  it.each(["he", "en"] as const)("reads every line once the name is a real one (%s)", (lang) => {
    const [, , ...lines] = copy[lang].pastePlaceholder.split("\n");
    const draft = parseConstraints(["בן נתנוב", ...lines].join("\n"), withPeople([ben]));
    expect(draft.lines.slice(1).map((line) => line.status)).toEqual(lines.map(() => "recognized"));
    expect(draft.proposals.ben[0]).toEqual([afternoon, night]);
    expect(draft.proposals.ben[2]).toEqual([morning, afternoon]);
    expect([3, 4, 5].map((day) => draft.proposals.ben[day])).toEqual([[], [], []]);
  });
});

describe("applyConstraintText", () => {
  it("writes availability only after approval, keeps no copy of the message, and leaves the agreement", () => {
    const state = withPeople([ben, guard(SENTINEL.dana, "Dana", [morning, afternoon])]);
    const text = "בן נתנוב\nראשון - לא עובד בוקר\nשלישי - לא עובד לילה\nמחר אולי";
    const approved = applyConstraintText(state, MANAGER, text);
    expect(approved.avail[week].ben[0]).toEqual([afternoon, night]);
    expect(approved.avail[week].ben[2]).toEqual([morning, afternoon]);
    expect(approved.notes).toBeUndefined();
    expect(approved.emps.find((employee) => employee.id === "ben")?.grid).toEqual(ben.grid);
    expect(approved.avail[week][SENTINEL.dana]).toBeUndefined();

    expect(applyConstraintText(state, { kind: "employee", employeeId: "ben" }, text)).toBe(state);
    expect(applyConstraintText(state, MANAGER, "משה כהן\nראשון - לא עובד בוקר")).toBe(state);
  });

  it("lets a manual edit of the grid override an approved message when the week is generated again", () => {
    const state = withPeople([ben]);
    for (const item of state.biz.shifts) item.req = item.id === morning ? [1, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0];
    const slot = `0|${morning}`;

    const approved = applyConstraintText(state, MANAGER, "בן נתנוב\nראשון - לא עובד בוקר");
    expect(generateWeek(approved).sched[week].assign[slot]).toEqual([]);

    const reopened = setAvailability(approved, MANAGER, "ben", 0, morning, true);
    expect(generateWeek(reopened).sched[week].assign[slot]).toEqual(["ben"]);

    const closedAgain = setAvailability(generateWeek(reopened), MANAGER, "ben", 0, morning, false);
    expect(generateWeek(closedAgain).sched[week].assign[slot]).toEqual([]);
  });

  it("does not let a recognized line open a shift the agreement closes", () => {
    const dana = guard(SENTINEL.dana, "Dana", [morning, afternoon]);
    const state = withPeople([dana]);
    const approved = applyConstraintText(state, MANAGER, "Dana\nSunday - can work night");
    expect(approved).toBe(state);
    expect(approved.emps[0].grid?.[0]).not.toContain(night);
  });

  it("does not freeze an empty agreement into an all-unavailable week", () => {
    const state = withPeople([guard("ben", "בן נתנוב", [])]);
    const approved = applyConstraintText(state, MANAGER, "בן נתנוב\nראשון - לא עובד בוקר");
    expect(approved.avail[week]?.ben).toBeUndefined();
    expect(approved.emps[0].grid).toEqual([[], [], [], [], [], [], []]);
  });
});

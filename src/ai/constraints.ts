import type { Lang, RotaState } from "../domain";
import { checkOverride, type ConstraintDraft, type LineOverride, type Polarity } from "../parser";

export const MAX_TEXT = 4000;
export const MAX_LINES = 40;

/** What the browser sends. No contact details, no agreement, no schedule. */
export interface ConstraintRequest {
  lang: Lang;
  text: string;
  /** Line numbers the rules left open. */
  lines: number[];
  roster: { id: string; name: string }[];
  shifts: { id: string; name: string; start: string; end: string }[];
}

export interface DroppedSuggestion {
  line: number | null;
  why: "line_not_requested" | "unknown_employee" | "bad_shape" | "duplicate_line";
}

export interface ConstraintAnswer {
  suggestions: LineOverride[];
  dropped: DroppedSuggestion[];
}

export function constraintRequest(state: RotaState, draft: ConstraintDraft, lang: Lang): ConstraintRequest | null {
  const lines = draft.lines.filter((line) => line.status !== "recognized").map((line) => line.line);
  if (lines.length === 0) return null;
  return {
    lang,
    text: draft.raw,
    lines,
    roster: state.emps.filter((employee) => employee.active).map((employee) => ({ id: employee.id, name: employee.name })),
    shifts: state.biz.shifts.map((shift) => ({ id: shift.id, name: shift.name, start: shift.start, end: shift.end })),
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Shape and size checks before anything reaches a provider. */
export function readConstraintRequest(body: unknown): ConstraintRequest | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  if (input.lang !== "he" && input.lang !== "en") return null;
  if (typeof input.text !== "string" || input.text.length === 0 || input.text.length > MAX_TEXT) return null;
  const textLines = input.text.split(/\r?\n/).length;
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > MAX_LINES) return null;
  if (!input.lines.every((line) => Number.isInteger(line) && line >= 1 && line <= textLines)) return null;
  if (!Array.isArray(input.roster) || input.roster.length === 0 || input.roster.length > 500) return null;
  const roster = input.roster as Record<string, unknown>[];
  if (!roster.every((item) => item && typeof item.id === "string" && typeof item.name === "string")) return null;
  if (!Array.isArray(input.shifts) || input.shifts.length === 0 || input.shifts.length > 20) return null;
  const shifts = input.shifts as Record<string, unknown>[];
  const clock = /^\d{2}:\d{2}$/;
  if (
    !shifts.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.start === "string" &&
        typeof item.end === "string" &&
        clock.test(item.start) &&
        clock.test(item.end),
    )
  ) {
    return null;
  }
  return {
    lang: input.lang,
    text: input.text,
    lines: [...new Set(input.lines as number[])],
    roster: roster.map((item) => ({ id: item.id as string, name: (item.name as string).slice(0, 80) })),
    shifts: shifts.map((item) => ({
      id: item.id as string,
      name: (item.name as string).slice(0, 40),
      start: item.start as string,
      end: item.end as string,
    })),
  };
}

const DAYS = "0=Sunday 1=Monday 2=Tuesday 3=Wednesday 4=Thursday 5=Friday 6=Saturday";

export function constraintPrompt(request: ConstraintRequest): { system: string; user: string } {
  const system = [
    "You read short availability messages that employees send to a shift manager, in Hebrew or English.",
    "Return JSON only, with this shape: {\"suggestions\":[{\"line\":number,\"employeeId\":string,\"days\":number[],\"shiftIds\":string[],\"polarity\":\"off\"|\"on\"|\"only\"}]}.",
    "polarity off = cannot work those shifts. on = can work them. only = can work only those shifts that day.",
    "An empty shiftIds means every shift that day, and is not allowed with polarity only.",
    `Days: ${DAYS}. Weeks start on Sunday.`,
    "Use only employee ids and shift ids from the lists. A line under a name line belongs to that person.",
    "Answer only for the requested line numbers. Leave a line out when you are not sure. Never guess a person.",
    "You do not assign shifts, approve anything, or change agreements.",
  ].join("\n");
  const numbered = request.text
    .split(/\r?\n/)
    .map((line, index) => `${index + 1}: ${line}`)
    .join("\n");
  const user = [
    `Employees: ${JSON.stringify(request.roster)}`,
    `Shifts: ${JSON.stringify(request.shifts)}`,
    `Requested lines: ${JSON.stringify(request.lines)}`,
    "Message:",
    numbered,
  ].join("\n");
  return { system, user };
}

function jsonFrom(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Anything off the roster, off the shift list, or outside the requested lines is dropped. */
export function readConstraintAnswer(output: string, request: ConstraintRequest, state: RotaState): ConstraintAnswer {
  const parsed = jsonFrom(output) as { suggestions?: unknown } | null;
  const answer: ConstraintAnswer = { suggestions: [], dropped: [] };
  if (!parsed || !Array.isArray(parsed.suggestions)) return answer;
  const requested = new Set(request.lines);
  const rosterIds = new Set(request.roster.map((person) => person.id));
  const seen = new Set<number>();
  for (const item of parsed.suggestions.slice(0, MAX_LINES)) {
    const raw = (item ?? {}) as Record<string, unknown>;
    const line = Number.isInteger(raw.line) ? (raw.line as number) : null;
    if (line === null || !Array.isArray(raw.days) || !Array.isArray(raw.shiftIds) || typeof raw.employeeId !== "string") {
      answer.dropped.push({ line, why: "bad_shape" });
      continue;
    }
    if (!requested.has(line)) {
      answer.dropped.push({ line, why: "line_not_requested" });
      continue;
    }
    if (seen.has(line)) {
      answer.dropped.push({ line, why: "duplicate_line" });
      continue;
    }
    if (!rosterIds.has(raw.employeeId)) {
      answer.dropped.push({ line, why: "unknown_employee" });
      continue;
    }
    const shiftIds = isStringArray(raw.shiftIds) ? raw.shiftIds : [];
    const override = checkOverride(
      {
        line,
        employeeId: raw.employeeId,
        days: raw.days as number[],
        shiftIds,
        allShifts: shiftIds.length === 0,
        polarity: raw.polarity as Polarity,
      },
      state,
    );
    if (!override) {
      answer.dropped.push({ line, why: "bad_shape" });
      continue;
    }
    seen.add(line);
    answer.suggestions.push(override);
  }
  return answer;
}

/** The roster and shift list the server checks against, built from the request itself. */
export function requestState(request: ConstraintRequest): RotaState {
  return {
    week: "2000-01-02",
    biz: {
      name: "",
      type: "",
      minRest: 0,
      maxHours: 0,
      maxShift: 0,
      assume: true,
      shifts: request.shifts.map((shift) => ({ ...shift, role: "", req: [1, 1, 1, 1, 1, 1, 1] })),
    },
    emps: request.roster.map((person) => ({
      id: person.id,
      name: person.name,
      contact: "",
      role: "",
      quals: "",
      perWeek: 0,
      maxHours: 0,
      pref: [],
      active: true,
    })),
    avail: {},
    sched: {},
    closed: {},
  };
}

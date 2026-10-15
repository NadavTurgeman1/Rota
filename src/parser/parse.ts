import { agreementAllows, shiftKind, type Employee, type RotaState, type ShiftDefinition } from "../domain";

export type LineStatus = "recognized" | "ambiguous" | "unparsed";
export type Polarity = "off" | "on" | "only";

export type ConstraintReason =
  | "unknown_employee"
  | "ambiguous_employee"
  | "ambiguous_shift"
  | "ambiguous_day"
  | "no_employee"
  | "missing_day"
  | "missing_shift"
  | "missing_polarity"
  | "conflict";

export interface ParsedLine {
  /** 1-based line number in the original paste. */
  line: number;
  raw: string;
  status: LineStatus;
  employeeId?: string;
  mentioned?: string;
  days: number[];
  shiftIds: string[];
  /** The line names no shift, so it applies to every shift that day. */
  allShifts: boolean;
  polarity?: Polarity;
  reason?: ConstraintReason;
  /** `model` when a manager accepted a model suggestion for a line the rules left open. */
  source?: "rules" | "model";
}

/** A reading of one line that the rules left open. Applied only after the same checks as a parsed line. */
export interface LineOverride {
  line: number;
  employeeId: string;
  days: number[];
  shiftIds: string[];
  allShifts: boolean;
  polarity: Polarity;
}

export interface ConstraintDraft {
  raw: string;
  lines: ParsedLine[];
  /** Availability rows for employees with at least one recognized constraint. */
  proposals: Record<string, string[][]>;
}

const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** Case, nikud, final letters, and spacing folded so name matching stays stable. */
export function fold(value: string): string {
  let letters = "";
  for (const char of value.normalize("NFD").replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")) {
    letters += FINALS[char] ?? char;
  }
  return letters
    .replace(/['’׳״"`´]/g, "")
    .replace(/[-–—־_/.,;:!?()[\]{}]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const DAY_PHRASES: { day: number; phrases: string[] }[] = [
  { day: 0, phrases: ["יום ראשון", "ראשון", "יום א", "א", "sunday", "sun"] },
  { day: 1, phrases: ["יום שני", "שני", "יום ב", "ב", "monday", "mon"] },
  { day: 2, phrases: ["יום שלישי", "שלישי", "יום ג", "ג", "tuesday", "tues", "tue"] },
  { day: 3, phrases: ["יום רביעי", "רביעי", "יום ד", "ד", "wednesday", "wed"] },
  { day: 4, phrases: ["יום חמישי", "חמישי", "יום ה", "ה", "thursday", "thurs", "thur", "thu"] },
  { day: 5, phrases: ["יום שישי", "שישי", "יום ו", "ו", "friday", "fri"] },
  { day: 6, phrases: ["יום שבת", "שבת", "saturday", "sat"] },
].map((group) => ({ day: group.day, phrases: group.phrases.map((phrase) => fold(phrase)) }));

const WEEK_PHRASES = ["כל השבוע", "כל הימים", "כל יום", "כל ימות השבוע", "all week", "every day", "all days"].map((phrase) => fold(phrase));

function polarityPhrases(polarity: Polarity, phrases: string[]): { polarity: Polarity; phrases: string[] } {
  return { polarity, phrases: phrases.map((phrase) => fold(phrase)) };
}

const POLARITY_PHRASES = [
  polarityPhrases("off", [
    "לא עובדת",
    "לא עובד",
    "לא יכולה",
    "לא יכול",
    "לא זמינה",
    "לא זמין",
    "לא פנויה",
    "לא פנוי",
    "not working",
    "not available",
    "unavailable",
    "cannot",
    "cant",
    "בלי",
    "no",
  ]),
  polarityPhrases("only", ["רק", "only"]),
  polarityPhrases("on", ["פנויה", "פנוי", "יכולה", "יכול", "זמינה", "זמין", "עובדת", "עובד", "available", "working", "free", "can"]),
];

const CONTRAST = ["לא רק", "not only", "however", "אבל", "but", "או", "or"].map((phrase) => fold(phrase));
const FILLERS = new Set(
  ["תודה", "רבה", "היי", "הי", "שלום", "נא", "hello", "hi", "hey", "thanks", "thank", "you", "please", "בבקשה", "ok"].map((phrase) => fold(phrase)),
);

/** "עד רביעי" may open a range at Sunday; "to" only joins two named days. */
const UNTIL = ["עד", "until", "till", "through", "thru"].map((phrase) => fold(phrase));
const TO = ["to"].map((phrase) => fold(phrase));
const BETWEEN = ["בין", "between"].map((phrase) => fold(phrase));
const ONWARD = ["והלאה", "ואילך", "onward", "onwards", "and on"].map((phrase) => fold(phrase));
const INCLUSIVE = ["כולל", "inclusive", "including", "included"].map((phrase) => fold(phrase));
const NOT_INCLUDING = ["לא כולל", "not including", "exclusive"].map((phrase) => fold(phrase));
const EXCEPT = ["חוץ", "מלבד", "פרט", "except", "except for", "excluding", "besides"].map((phrase) => fold(phrase));
const RANGE_FILLERS = ["from", "starting", "החל"].map((phrase) => fold(phrase));
/** "בלי" is an exception when a day follows it and the line already said something else; otherwise it means "not available". */
const WITHOUT = fold("בלי");

const SINGLE_DAY_TOKENS = new Map(
  DAY_PHRASES.flatMap((group) => group.phrases.filter((phrase) => !phrase.includes(" ")).map((phrase) => [phrase, group.day] as const)),
);

function isDayWord(word: string): boolean {
  const folded = fold(word);
  const bare = folded.slice(1);
  return SINGLE_DAY_TOKENS.has(folded) || ("בלמהו".includes(folded[0]) && bare.length > 1 && SINGLE_DAY_TOKENS.has(bare));
}

/** "ראשון-רביעי" and "א׳–ד׳" are ranges. The dash is lost in `fold`, so it becomes "עד" first. */
function rangeDashes(text: string): string {
  return text.replace(/([^\s\-–—]+)\s*[-–—]\s*([^\s\-–—]+)/g, (match, left: string, right: string) =>
    isDayWord(left) && isDayWord(right) ? `${left} עד ${right}` : match,
  );
}

interface Token {
  token: string;
  start: number;
  end: number;
}

type Mark =
  | { kind: "day"; day: number; phrase: string; start: number; end: number }
  | { kind: "week"; start: number; end: number }
  | { kind: "polarity"; polarity: Polarity; phrase: string; start: number; end: number }
  | { kind: "shift"; shiftIds: string[]; start: number; end: number }
  | { kind: "contrast"; start: number; end: number }
  | { kind: "until" | "to" | "between" | "onward" | "inclusive" | "notIncluding" | "except" | "filler"; start: number; end: number };

const RANGE_MARKS: [Exclude<Mark["kind"], "day" | "week" | "polarity" | "shift" | "contrast">, string[]][] = [
  ["until", UNTIL],
  ["to", TO],
  ["between", BETWEEN],
  ["onward", ONWARD],
  ["inclusive", INCLUSIVE],
  ["notIncluding", NOT_INCLUDING],
  ["except", EXCEPT],
  ["filler", RANGE_FILLERS],
];

function tokensOf(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    tokens.push({ token: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

function matchesToken(token: string, phrase: string, allowClitic: boolean): boolean {
  if (token === phrase) return true;
  return Boolean(
    allowClitic &&
      !phrase.includes(" ") &&
      token.length === phrase.length + 1 &&
      "בלמהו".includes(token[0]) &&
      token.slice(1) === phrase,
  );
}

function findPhrase(tokens: Token[], phrase: string): { start: number; end: number }[] {
  const parts = phrase.split(" ");
  const hits: { start: number; end: number }[] = [];
  for (let index = 0; index <= tokens.length - parts.length; index += 1) {
    const matched = parts.every((part, offset) => matchesToken(tokens[index + offset].token, part, offset === 0));
    if (!matched) continue;
    hits.push({ start: tokens[index].start, end: tokens[index + parts.length - 1].end });
  }
  return hits;
}

function shiftPhrases(shifts: ShiftDefinition[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (phrase: string, id: string) => {
    const key = fold(phrase);
    if (!key) return;
    const list = map.get(key) ?? [];
    if (!list.includes(id)) list.push(id);
    map.set(key, list);
  };
  for (const shift of shifts) {
    add(shift.name, shift.id);
    const kind = shiftKind(shift.start, shift.end);
    const aliases =
      kind === "m"
        ? ["בוקר", "בקר", "morning", "am"]
        : kind === "n"
          ? ["לילה", "לילות", "night", "nights"]
          : ["צהריים", "צהרים", "אחהצ", "אחר הצהריים", "אחר הצהרים", "afternoon", "noon"];
    for (const alias of aliases) add(alias, shift.id);
  }
  const namedEvening = shifts.filter((shift) => /ערב|evening/.test(fold(shift.name)));
  const evening = namedEvening.length > 0 ? namedEvening : shifts.filter((shift) => shiftKind(shift.start, shift.end) === "a");
  for (const shift of evening) {
    for (const alias of ["ערב", "evening", "eve"]) add(alias, shift.id);
  }
  return map;
}

function lexicon(shifts: Map<string, string[]>): Set<string> {
  const words = new Set<string>(FILLERS);
  for (const group of DAY_PHRASES) for (const phrase of group.phrases) for (const token of phrase.split(" ")) words.add(token);
  for (const phrase of WEEK_PHRASES) for (const token of phrase.split(" ")) words.add(token);
  for (const group of POLARITY_PHRASES) for (const phrase of group.phrases) for (const token of phrase.split(" ")) words.add(token);
  for (const phrase of CONTRAST) words.add(phrase);
  for (const [, phrases] of RANGE_MARKS) for (const phrase of phrases) for (const token of phrase.split(" ")) words.add(token);
  for (const phrase of shifts.keys()) for (const token of phrase.split(" ")) words.add(token);
  return words;
}

function scan(text: string, shifts: Map<string, string[]>): Mark[] {
  const tokens = tokensOf(text);
  const found: Mark[] = [];
  const add = (phrase: string, build: (span: { start: number; end: number }) => Mark) => {
    for (const span of findPhrase(tokens, phrase)) found.push(build(span));
  };
  for (const group of DAY_PHRASES) {
    for (const phrase of group.phrases) add(phrase, (span) => ({ kind: "day", day: group.day, phrase, ...span }));
  }
  for (const phrase of WEEK_PHRASES) add(phrase, (span) => ({ kind: "week", ...span }));
  for (const group of POLARITY_PHRASES) {
    for (const phrase of group.phrases) add(phrase, (span) => ({ kind: "polarity", polarity: group.polarity, phrase, ...span }));
  }
  for (const phrase of CONTRAST) add(phrase, (span) => ({ kind: "contrast", ...span }));
  for (const [kind, phrases] of RANGE_MARKS) for (const phrase of phrases) add(phrase, (span) => ({ kind, ...span }));
  for (const [phrase, shiftIds] of shifts) add(phrase, (span) => ({ kind: "shift", shiftIds, ...span }));

  const sorted = [...found].sort((left, right) => right.end - right.start - (left.end - left.start) || left.start - right.start);
  const taken: Mark[] = [];
  for (const hit of sorted) {
    if (taken.some((item) => hit.start < item.end && item.start < hit.end)) continue;
    taken.push(hit);
  }
  const marks = taken.sort((left, right) => left.start - right.start);
  return marks.map((mark, index) => {
    if (mark.kind !== "polarity" || mark.phrase !== WITHOUT || marks[index + 1]?.kind !== "day") return mark;
    const saidMore = marks.some((other, at) => at !== index && (other.kind === "polarity" || ((other.kind === "day" || other.kind === "week") && at < index)));
    return saidMore ? { kind: "except", start: mark.start, end: mark.end } : mark;
  });
}

function siteClosed(state: RotaState, day: number, shiftId: string): boolean {
  const shift = state.biz.shifts.find((item) => item.id === shiftId);
  return !shift || Number(shift.req[day] || 0) <= 0;
}

function openShiftIds(state: RotaState, employee: Employee, day: number): string[] {
  return state.biz.shifts
    .map((shift) => shift.id)
    .filter((shiftId) => agreementAllows(employee, day, shiftId) && !siteClosed(state, day, shiftId));
}

function baseline(state: RotaState, employee: Employee): string[][] {
  const submitted = state.avail[state.week]?.[employee.id];
  if (submitted) return submitted.map((day) => [...day]);
  return [0, 1, 2, 3, 4, 5, 6].map((day) => openShiftIds(state, employee, day));
}

function applyParsed(row: string[][], state: RotaState, employee: Employee, line: ParsedLine): void {
  const ids = line.allShifts ? state.biz.shifts.map((shift) => shift.id) : line.shiftIds;
  for (const day of line.days) {
    if (line.polarity === "only") {
      const allow = new Set(openShiftIds(state, employee, day));
      row[day] = state.biz.shifts.map((shift) => shift.id).filter((shiftId) => ids.includes(shiftId) && allow.has(shiftId));
      continue;
    }
    if (line.polarity === "off") {
      const drop = new Set(ids);
      row[day] = row[day].filter((shiftId) => !drop.has(shiftId));
      continue;
    }
    const allow = new Set(openShiftIds(state, employee, day));
    const have = new Set(row[day]);
    for (const shiftId of ids) if (allow.has(shiftId)) have.add(shiftId);
    row[day] = state.biz.shifts.map((shift) => shift.id).filter((shiftId) => have.has(shiftId));
  }
}

interface NameHit {
  ids: string[];
  rest: string;
  mentioned: string;
}

function leadingName(text: string, employees: Employee[], blocked: Set<string>): NameHit | "ambiguous" | null {
  const tokens = text.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;
  let exact: { ids: string[]; length: number } | null = null;
  for (const employee of employees) {
    const name = fold(employee.name).split(" ").filter(Boolean);
    if (name.length === 0 || name.length > tokens.length) continue;
    if (!name.every((token, index) => token === tokens[index])) continue;
    if (!exact || name.length > exact.length) exact = { ids: [employee.id], length: name.length };
    else if (name.length === exact.length && !exact.ids.includes(employee.id)) exact.ids.push(employee.id);
  }
  if (exact) {
    if (exact.ids.length > 1) return "ambiguous";
    return { ids: exact.ids, rest: tokens.slice(exact.length).join(" "), mentioned: tokens.slice(0, exact.length).join(" ") };
  }
  if (blocked.has(tokens[0])) return null;
  const prefix = employees.filter((employee) => fold(employee.name).split(" ").filter(Boolean)[0] === tokens[0]);
  if (prefix.length > 1) return "ambiguous";
  if (prefix.length === 0) return null;
  const name = fold(prefix[0].name).split(" ").filter(Boolean);
  let take = 1;
  while (take < name.length && tokens[take] === name[take]) take += 1;
  return { ids: [prefix[0].id], rest: tokens.slice(take).join(" "), mentioned: tokens.slice(0, take).join(" ") };
}

function blankLine(status: LineStatus, line: number, raw: string, extra: Partial<ParsedLine> = {}): ParsedLine {
  return { line, raw, status, days: [], shiftIds: [], allShifts: false, ...extra };
}

const WEEK = [0, 1, 2, 3, 4, 5, 6];

/** Inclusive, and wraps past Saturday: Thursday to Sunday is 4, 5, 6, 0. */
function span(from: number, to: number): number[] {
  const days = [from];
  for (let day = from; day !== to; ) {
    day = (day + 1) % 7;
    days.push(day);
  }
  return days;
}

interface DayReading {
  /** Days the line is about. Every day when it names none and only lists exceptions. */
  days: number[];
  /** Days named after "except", "חוץ מ", "בלי" and the like. */
  excluded: number[];
  ambiguous: boolean;
}

function readDays(marks: Mark[]): DayReading {
  const specific = marks.filter((mark) => mark.kind === "day");
  const lone = specific.filter((mark) => mark.phrase === "ו");
  const sequence = marks.filter(
    (mark) =>
      mark.kind === "week" ||
      (mark.kind === "day" && (mark.phrase !== "ו" || specific.length === lone.length)) ||
      ["until", "to", "between", "onward", "notIncluding", "except"].includes(mark.kind),
  );
  const included = new Set<number>();
  const excluded = new Set<number>();
  let week = false;
  let excepting = false;
  const target = () => (excepting ? excluded : included);
  const dayAt = (index: number) => {
    const mark = sequence[index];
    return mark?.kind === "day" ? mark.day : null;
  };

  for (let index = 0; index < sequence.length; index += 1) {
    const mark = sequence[index];
    if (mark.kind === "except") {
      excepting = true;
      continue;
    }
    if (mark.kind === "notIncluding") {
      excepting = true;
      continue;
    }
    if (mark.kind === "week") {
      if (excepting) return { days: [], excluded: [], ambiguous: true };
      week = true;
      continue;
    }
    if (mark.kind === "until" || mark.kind === "to") {
      const end = dayAt(index + 1);
      if (end === null || mark.kind === "to") return { days: [], excluded: [], ambiguous: true };
      const exclusive = sequence[index + 2]?.kind === "notIncluding";
      for (const day of span(0, end)) if (!(exclusive && day === end)) target().add(day);
      index += exclusive ? 2 : 1;
      continue;
    }
    if (mark.kind !== "day") continue;

    const next = sequence[index + 1];
    const opensRange = next?.kind === "until" || next?.kind === "to";
    const between = sequence[index - 1]?.kind === "between" && dayAt(index + 1) !== null;
    if (opensRange || between) {
      const endIndex = between ? index + 1 : index + 2;
      const end = dayAt(endIndex);
      if (end === null) return { days: [], excluded: [], ambiguous: true };
      const exclusive = sequence[endIndex + 1]?.kind === "notIncluding";
      for (const day of span(mark.day, end)) if (!(exclusive && day === end)) target().add(day);
      index = exclusive ? endIndex + 1 : endIndex;
      continue;
    }
    if (next?.kind === "onward") {
      for (const day of span(mark.day, 6)) target().add(day);
      index += 1;
      continue;
    }
    target().add(mark.day);
  }

  if (week && included.size > 0) return { days: [], excluded: [], ambiguous: true };
  const base = week || (included.size === 0 && excluded.size > 0) ? WEEK : [...included];
  return {
    days: [...new Set(base)].sort((left, right) => left - right),
    excluded: [...excluded].sort((left, right) => left - right),
    ambiguous: false,
  };
}

/**
 * "Available all week except Friday" means Friday off. "Off all week except Tuesday" and "only mornings except Friday"
 * keep their polarity on the remaining days.
 */
function withExceptions(polarity: Polarity, reading: DayReading): { polarity: Polarity; days: number[] } {
  if (reading.excluded.length === 0) return { polarity, days: reading.days };
  if (polarity === "on") return { polarity: "off", days: reading.excluded };
  return { polarity, days: reading.days.filter((day) => !reading.excluded.includes(day)) };
}

/** Free text → a draft. Does not write availability. */
/** Null when the override names someone off the roster, an unknown shift, or an impossible day. */
export function checkOverride(override: LineOverride, state: RotaState): LineOverride | null {
  if (!Number.isInteger(override.line) || override.line < 1) return null;
  if (!state.emps.some((employee) => employee.id === override.employeeId)) return null;
  if (!["off", "on", "only"].includes(override.polarity)) return null;
  const days = [...new Set(override.days)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  if (days.length === 0 || days.length !== override.days.length) return null;
  const known = new Set(state.biz.shifts.map((shift) => shift.id));
  const shiftIds = [...new Set(override.shiftIds)];
  if (shiftIds.some((id) => !known.has(id))) return null;
  const allShifts = shiftIds.length === 0;
  if (allShifts !== override.allShifts) return null;
  if (allShifts && override.polarity === "only") return null;
  return { ...override, days: days.sort((left, right) => left - right), shiftIds, allShifts };
}

export function parseConstraints(raw: string, state: RotaState, overrides: LineOverride[] = []): ConstraintDraft {
  const phrases = shiftPhrases(state.biz.shifts);
  const blocked = lexicon(phrases);
  const lines: ParsedLine[] = [];
  let current: string | undefined;
  const source = raw.split(/\r?\n/);

  for (let index = 0; index < source.length; index += 1) {
    const original = source[index].trim();
    const lineNo = index + 1;
    const text = fold(rangeDashes(original));
    if (!text) {
      if (original) lines.push(blankLine("unparsed", lineNo, original));
      continue;
    }
    const name = leadingName(text, state.emps, blocked);
    if (name === "ambiguous") {
      current = undefined;
      lines.push(blankLine("ambiguous", lineNo, original, { reason: "ambiguous_employee", mentioned: original }));
      continue;
    }

    const body = name ? name.rest : text;
    const employeeId = name?.ids[0] ?? current;
    const marks = scan(body, phrases);
    const tokens = body.split(" ").filter(Boolean);
    const filler = tokens.length > 0 && tokens.every((token) => FILLERS.has(token));

    if (name && (body === "" || filler)) {
      current = name.ids[0];
      lines.push(blankLine("recognized", lineNo, original, { employeeId: current, mentioned: name.mentioned }));
      continue;
    }
    if (!name && filler) {
      lines.push(blankLine("unparsed", lineNo, original));
      continue;
    }
    if (!name && marks.length === 0) {
      current = undefined;
      lines.push(
        blankLine("unparsed", lineNo, original, {
          reason: /\p{L}/u.test(text) ? "unknown_employee" : undefined,
          mentioned: original,
        }),
      );
      continue;
    }

    const days = readDays(marks);
    const polarities = [...new Set(marks.flatMap((mark) => (mark.kind === "polarity" ? [mark.polarity] : [])))];
    const shiftMarks = marks.filter((mark): mark is Extract<Mark, { kind: "shift" }> => mark.kind === "shift");
    const ambiguousShift = shiftMarks.some((mark) => mark.shiftIds.length > 1);
    const shiftIds = [...new Set(shiftMarks.flatMap((mark) => mark.shiftIds))];
    const base = { employeeId, mentioned: name?.mentioned, days: days.days, shiftIds, allShifts: false };

    if (name) current = name.ids[0];
    if (!employeeId) {
      lines.push(blankLine("ambiguous", lineNo, original, { ...base, reason: "no_employee" }));
      continue;
    }
    if (marks.some((mark) => mark.kind === "contrast") || polarities.length > 1) {
      lines.push(blankLine("ambiguous", lineNo, original, { ...base, employeeId, reason: "conflict" }));
      continue;
    }
    if (ambiguousShift) {
      lines.push(blankLine("ambiguous", lineNo, original, { ...base, employeeId, shiftIds: [], reason: "ambiguous_shift" }));
      continue;
    }
    if (days.ambiguous) {
      lines.push(blankLine("ambiguous", lineNo, original, { ...base, employeeId, days: [], reason: "ambiguous_day" }));
      continue;
    }
    if (polarities.length === 0) {
      lines.push(blankLine("ambiguous", lineNo, original, { ...base, employeeId, reason: "missing_polarity" }));
      continue;
    }
    const resolved = withExceptions(polarities[0], days);
    const polarity = resolved.polarity;
    base.days = resolved.days;
    if (resolved.days.length === 0) {
      lines.push(blankLine("ambiguous", lineNo, original, { ...base, employeeId, reason: "missing_day" }));
      continue;
    }
    if (shiftIds.length === 0 && polarity === "only") {
      lines.push(blankLine("ambiguous", lineNo, original, { ...base, employeeId, polarity, reason: "missing_shift" }));
      continue;
    }
    lines.push(
      blankLine("recognized", lineNo, original, {
        ...base,
        employeeId,
        polarity,
        allShifts: shiftIds.length === 0,
      }),
    );
  }

  for (const candidate of overrides) {
    const override = checkOverride(candidate, state);
    if (!override) continue;
    const index = lines.findIndex((line) => line.line === override.line);
    if (index < 0 || lines[index].status === "recognized") continue;
    lines[index] = {
      line: override.line,
      raw: lines[index].raw,
      status: "recognized",
      employeeId: override.employeeId,
      days: override.days,
      shiftIds: override.shiftIds,
      allShifts: override.allShifts,
      polarity: override.polarity,
      source: "model",
    };
  }

  const proposals: Record<string, string[][]> = {};
  for (const line of lines) {
    if (line.status !== "recognized" || !line.polarity || !line.employeeId) continue;
    const employee = state.emps.find((item) => item.id === line.employeeId);
    if (!employee) continue;
    const row = proposals[employee.id] ?? baseline(state, employee);
    applyParsed(row, state, employee, line);
    proposals[employee.id] = row;
  }
  return { raw, lines, proposals };
}

export function constraintDraftWritable(draft: ConstraintDraft): boolean {
  return draft.lines.some((line) => line.status === "recognized" && line.polarity);
}

import { addDays } from "./time";
import type { RotaState } from "./types";

export type AbsenceKind = "sick" | "vacation";

export interface ApprovedAbsence {
  employeeId: string;
  kind: AbsenceKind;
  start: string;
  end: string;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function dateInRange(date: string, start: string, end: string): boolean {
  return DAY.test(date) && DAY.test(start) && DAY.test(end) && date >= start && date <= end;
}

/** Approved absence covering this calendar date, if any. */
export function absenceOnDate(absences: ApprovedAbsence[] | undefined, employeeId: string, date: string): AbsenceKind | null {
  if (!absences) return null;
  for (const row of absences) {
    if (row.employeeId === employeeId && dateInRange(date, row.start, row.end)) return row.kind;
  }
  return null;
}

/** Approved absence covering weekday `day` of `week`. */
export function absenceOnWeekDay(state: RotaState, employeeId: string, day: number, week = state.week): AbsenceKind | null {
  if (!Number.isInteger(day) || day < 0 || day > 6) return null;
  return absenceOnDate(state.absences, employeeId, addDays(week, day));
}

/** Click a calendar day: first click is one day, second click opens a range, clicking the same day again clears it. */
export function clickAbsenceDay(start: string, end: string, day: string): { start: string; end: string } {
  if (!DAY.test(day)) return { start, end };
  if (start && start === end && day === start) return { start: "", end: "" };
  if (!start || (start !== end && Boolean(end))) return { start: day, end: day };
  if (day < start) return { start: day, end: start };
  return { start, end: day };
}

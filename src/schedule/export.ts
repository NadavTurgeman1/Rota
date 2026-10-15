import { coveredSeats, dayName, shiftKind, slots, type Lang, type RotaState } from "../domain";
import { clockLabel } from "./edit";
import { formatDayDate, formatWeekRange, shiftLabel, siteLabel } from "./display";

export interface ExportPerson {
  name: string;
  /** Actual hours, only when the shift was extended. */
  hours?: string;
  over?: boolean;
}

export interface ExportCell {
  closed: boolean;
  required: number;
  people: ExportPerson[];
  /** Seats filled by an approved extension of a neighbouring shift. */
  covered: number;
  open: number;
}

export interface ExportRow {
  shift: string;
  hours: string;
  kind: "m" | "a" | "n";
  cells: ExportCell[];
}

export interface WeekExport {
  dir: "rtl" | "ltr";
  title: string;
  subtitle: string;
  days: { name: string; date: string }[];
  rows: ExportRow[];
  open: number;
  extended: number;
}

/** The published week as a table for the PNG. A draft is never exported. */
export function weekExport(state: RotaState, lang: Lang, org: string): WeekExport | null {
  const schedule = state.sched[state.week];
  if (!schedule || schedule.status !== "published") return null;
  const names = new Map([...Object.entries(state.former ?? {}), ...state.emps.map((employee) => [employee.id, employee.name] as const)]);
  const weekSlots = slots(state, state.week);
  let open = 0;
  let extended = 0;
  const rows = state.biz.shifts.map((shift) => ({
    shift: shiftLabel(shift.name, lang),
    hours: `${shift.start}–${shift.end}`,
    kind: shiftKind(shift.start, shift.end),
    cells: [0, 1, 2, 3, 4, 5, 6].map((day): ExportCell => {
      const slot = weekSlots.find((item) => item.day === day && item.shiftId === shift.id);
      if (!slot) return { closed: true, required: 0, people: [], covered: 0, open: 0 };
      const people = (schedule.assign[slot.key] ?? []).map((id): ExportPerson => {
        const extension = schedule.ext?.[`${slot.key}#${id}`];
        if (extension) extended += 1;
        return {
          name: names.get(id) ?? id,
          ...(extension ? { hours: `${clockLabel(extension.start)}–${clockLabel(extension.end)}` } : {}),
          ...(schedule.over?.[`${slot.key}#${id}`] ? { over: true } : {}),
        };
      });
      const covered = coveredSeats(schedule, slot.key);
      const missing = Math.max(0, slot.required - people.length - covered);
      open += missing;
      return { closed: false, required: slot.required, people, covered, open: missing };
    }),
  }));
  return {
    dir: lang === "he" ? "rtl" : "ltr",
    title: `${org} · ${siteLabel(state.biz.name, lang)}`,
    subtitle: formatWeekRange(state.week, lang),
    days: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ name: dayName(day, lang), date: formatDayDate(state.week, day, lang) })),
    rows,
    open,
    extended,
  };
}

export const BACKUP_FORMAT = "rota.backup.v1";

/** Everything the demo organization holds, for a manual backup. */
export function backupJson(state: RotaState, meta: { org: string; at: string }): string {
  return JSON.stringify({ format: BACKUP_FORMAT, org: meta.org, exportedAt: meta.at, state }, null, 2);
}

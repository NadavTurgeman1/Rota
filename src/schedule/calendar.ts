import { addDays } from "../domain/time";
import type { RotaState } from "../domain/types";

/** Event title for a published shift: work, then the site, then the business. */
export function calendarTitle(siteName: string, businessName: string): string {
  return `עבודה - ${siteName} - ${businessName}`;
}

export interface CalendarShift {
  dayIndex: number;
  start: string;
  end: string;
  id: string;
  /** Overrides the shared calendar title, so each site can name its own events. */
  title?: string;
}

/** This employee's shifts on the published week currently open. */
export function ownPublishedShifts(state: RotaState, employeeId: string): CalendarShift[] {
  const schedule = state.sched[state.week];
  if (schedule?.status !== "published") return [];
  const found: CalendarShift[] = [];
  for (const [key, ids] of Object.entries(schedule.assign)) {
    if (!ids.includes(employeeId)) continue;
    const [dayText, shiftId] = key.split("|");
    const shift = state.biz.shifts.find((item) => item.id === shiftId);
    const dayIndex = Number(dayText);
    if (!shift || !Number.isInteger(dayIndex)) continue;
    found.push({ dayIndex, start: shift.start, end: shift.end, id: shiftId });
  }
  found.sort((left, right) => left.dayIndex - right.dayIndex || left.start.localeCompare(right.start));
  return found;
}

function clockMinutes(clock: string): number {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function stamp(day: string, clock: string): string {
  const [hour = "00", minute = "00"] = clock.split(":");
  return `${day.replaceAll("-", "")}T${hour.padStart(2, "0")}${minute.padStart(2, "0")}00`;
}

function escapeText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}

function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const next = current + char;
    if (encoder.encode(next).length > 73 && current) {
      parts.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join("\r\n");
}

/** A calendar file of wall-clock shift times. An end at or before the start is the next day. */
export function shiftsIcs(input: { title: string; week: string; employeeId: string; shifts: CalendarShift[] }): string {
  const events = input.shifts.map((shift) => {
    const day = addDays(input.week, shift.dayIndex);
    const overnight = clockMinutes(shift.end) <= clockMinutes(shift.start);
    const endDay = overnight ? addDays(day, 1) : day;
    const lines = [
      "BEGIN:VEVENT",
      `UID:${input.employeeId}-${day}-${shift.id}@rota`,
      `DTSTART:${stamp(day, shift.start)}`,
      `DTEND:${stamp(endDay, shift.end)}`,
      fold(`SUMMARY:${escapeText(shift.title ?? input.title)}`),
      "END:VEVENT",
    ];
    return lines.join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rota//shifts//HE", ...events, "END:VCALENDAR", ""].join("\r\n");
}

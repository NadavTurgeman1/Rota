import { addDays, gapBetween } from "./time";
import { effectiveSlot } from "./schedule";
import { dayName, slots, type Lang } from "./rules";
import type { RotaState, Slot } from "./types";

/**
 * Notes from the Hours of Work and Rest Law, 1951, and the private-sector
 * 42-hour week. Nothing here blocks an assignment or publishing.
 */
const DAILY_REST = 8;
const WEEKLY_REST = 36;
const DAY_CAP = 12;
const NIGHT_DAY = 7;
const EVE_DAY = 7;
const WEEK_HOURS = 42;
const OVERTIME_CAP = 16;
const NIGHT_WEEK_CAP = 58;

function hoursText(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function nightOverlap(start: number, end: number): number {
  let hours = 0;
  for (let day = -8; day <= 15; day += 1) {
    const overlap = Math.min(end, day * 24 + 30) - Math.max(start, day * 24 + 22);
    if (overlap > 0) hours += overlap;
  }
  return hours;
}

function worked(state: RotaState, week: string, employeeId: string, hourOffset: number): Slot[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const shifts: Slot[] = [];
  for (const slot of slots(state, week)) {
    if (!(schedule.assign[slot.key] ?? []).includes(employeeId)) continue;
    const effective = effectiveSlot(schedule, slot, employeeId);
    shifts.push({ ...effective, start: effective.start + hourOffset, end: effective.end + hourOffset });
  }
  return shifts;
}

function longestRest(mine: Slot[], previous: Slot[] | null, next: Slot[] | null): number {
  const sorted = [...mine, ...(previous ?? []), ...(next ?? [])].sort((left, right) => left.start - right.start);
  const here = [...mine].sort((left, right) => left.start - right.start);
  let best = 0;
  if (!previous) best = Math.max(best, here[0].start + 24);
  if (!next) best = Math.max(best, 168 - here[here.length - 1].end + 24);
  if (previous && previous.length === 0) best = Math.max(best, 168);
  if (next && next.length === 0) best = Math.max(best, 168);
  for (let index = 1; index < sorted.length; index += 1) {
    best = Math.max(best, sorted[index].start - sorted[index - 1].end);
  }
  return best;
}

export function laborNotes(state: RotaState, week: string, lang: Lang = "he"): string[] {
  const schedule = state.sched[week];
  if (!schedule) return [];
  const notes: string[] = [];
  const he = lang === "he";
  const previousWeek = addDays(week, -7);
  const nextWeek = addDays(week, 7);

  for (const employee of state.emps) {
    if (!employee.active) continue;
    const mine = worked(state, week, employee.id, 0);
    if (!mine.length) continue;
    const name = employee.name;
    const previous = state.sched[previousWeek] ? worked(state, previousWeek, employee.id, -168) : null;
    const next = state.sched[nextWeek] ? worked(state, nextWeek, employee.id, 168) : null;
    const timeline = [...mine, ...(previous ?? []), ...(next ?? [])].sort((left, right) => left.start - right.start);
    let shortest = Number.POSITIVE_INFINITY;
    for (let index = 1; index < timeline.length; index += 1) {
      shortest = Math.min(shortest, gapBetween(timeline[index - 1], timeline[index]));
    }
    if (shortest < DAILY_REST - 1e-9) {
      const gap = hoursText(Math.max(0, shortest));
      notes.push(
        he
          ? `${name}: מנוחה של ${gap} שעות בין משמרות, פחות מ־8 שעות לפי חוק שעות עבודה ומנוחה.`
          : `${name}: ${gap}h between shifts, under the 8h required by the Hours of Work and Rest Law.`,
      );
    }

    const byDay = new Map<number, number>();
    let longestNight = 0;
    let hasNight = false;
    for (const shift of mine) {
      byDay.set(shift.day, (byDay.get(shift.day) ?? 0) + shift.end - shift.start);
      if (nightOverlap(shift.start, shift.end) >= 2) {
        hasNight = true;
        longestNight = Math.max(longestNight, shift.end - shift.start);
      }
    }
    let busiest = 0;
    let busiestDay = 0;
    for (const [day, hours] of byDay) {
      if (hours > busiest) {
        busiest = hours;
        busiestDay = day;
      }
    }
    if (busiest > DAY_CAP + 1e-9) {
      const amount = hoursText(busiest);
      notes.push(
        he
          ? `${name}: ${amount} שעות ב${dayName(busiestDay, lang)}, מעל 12 השעות המרביות ביום כולל שעות נוספות.`
          : `${name}: ${amount}h on ${dayName(busiestDay, lang)}, over the 12h day including overtime.`,
      );
    }
    if (longestNight > NIGHT_DAY + 1e-9) {
      const amount = hoursText(longestNight);
      notes.push(
        he
          ? `${name}: משמרת לילה של ${amount} שעות, מעל 7 שעות של יום עבודת לילה.`
          : `${name}: a night shift of ${amount}h, over the 7h night workday.`,
      );
    }
    const friday = byDay.get(5) ?? 0;
    if (friday > EVE_DAY + 1e-9) {
      const amount = hoursText(friday);
      notes.push(
        he
          ? `${name}: ${amount} שעות ביום שלפני המנוחה השבועית, מעל 7 שעות.`
          : `${name}: ${amount}h on the day before the weekly rest, over 7h.`,
      );
    }

    const weekly = mine.reduce((sum, shift) => sum + shift.end - shift.start, 0);
    if (hasNight && weekly > NIGHT_WEEK_CAP + 1e-9) {
      notes.push(
        he
          ? `${name}: ${hoursText(weekly)} שעות השבוע עם עבודת לילה, מעל 58 שעות.`
          : `${name}: ${hoursText(weekly)}h this week with night work, over 58h.`,
      );
    } else if (weekly - WEEK_HOURS > OVERTIME_CAP + 1e-9) {
      notes.push(
        he
          ? `${name}: ${hoursText(weekly - WEEK_HOURS)} שעות נוספות השבוע, מעל 16 השעות הנוספות המותרות.`
          : `${name}: ${hoursText(weekly - WEEK_HOURS)} overtime hours this week, over the 16h overtime cap.`,
      );
    } else if (weekly > WEEK_HOURS + 1e-9) {
      notes.push(
        he
          ? `${name}: ${hoursText(weekly)} שעות השבוע, מעל 42 שעות של שבוע עבודה במגזר הפרטי.`
          : `${name}: ${hoursText(weekly)}h this week, over the 42h private-sector week.`,
      );
    }

    const rest = longestRest(mine, previous, next);
    if (rest < WEEKLY_REST - 1e-9) {
      notes.push(
        he
          ? `${name}: אין 36 שעות מנוחה רצופות השבוע.`
          : `${name}: no 36 consecutive hours of weekly rest.`,
      );
    }

    const neighborNights = [previous, next].some((shifts) => shifts?.some((shift) => nightOverlap(shift.start, shift.end) >= 2));
    if (hasNight && neighborNights) {
      notes.push(
        he
          ? `${name}: עבודת לילה גם בשבוע סמוך. במשמרות, החוק מגביל לשבוע לילה אחד מתוך שבועיים.`
          : `${name}: night work in a neighbouring week too. Shift work is limited to one night week in two.`,
      );
    }
  }
  return notes;
}

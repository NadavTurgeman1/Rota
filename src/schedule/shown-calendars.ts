import { addDays, type Lang } from "../domain";
import { faithHolidays } from "./faith-holidays";
import { hebrewWeek, hebrewWeekRange, holidaysBetween, type Holiday } from "./hebrew-calendar";

export interface CalendarPrefs {
  hebrew: boolean;
  christian: boolean;
  muslim: boolean;
}

export const CALENDARS_OFF: CalendarPrefs = { hebrew: false, christian: false, muslim: false };

/** A bare `true` keeps the old Hebrew-on export. An object turns on only the flags that are exactly true. */
export function resolveCalendars(value?: boolean | CalendarPrefs): CalendarPrefs {
  if (typeof value === "boolean") return { hebrew: value, christian: false, muslim: false };
  if (!value) return { hebrew: true, christian: false, muslim: false };
  return {
    hebrew: value.hebrew === true,
    christian: value.christian === true,
    muslim: value.muslim === true,
  };
}

export function anyCalendar(prefs: CalendarPrefs): boolean {
  return prefs.hebrew || prefs.christian || prefs.muslim;
}

function merge(target: Map<string, Holiday[]>, extra: Map<string, Holiday[]>) {
  for (const [iso, holidays] of extra) {
    target.set(iso, [...(target.get(iso) ?? []), ...holidays]);
  }
}

/** Holiday names for a date range. Hebrew dates are not included. */
export function rangeHolidays(startIso: string, endIso: string, lang: Lang, prefs: CalendarPrefs): Map<string, Holiday[]> {
  const days = new Map<string, Holiday[]>();
  if (prefs.hebrew) merge(days, holidaysBetween(startIso, endIso, lang));
  if (prefs.christian || prefs.muslim) merge(days, faithHolidays(startIso, endIso, lang, prefs));
  return days;
}

export interface DayMark {
  hebrew: string;
  holidays: Holiday[];
}

/** Hebrew date, when that calendar is on, plus every holiday the viewer turned on. */
export function weekMarks(week: string, lang: Lang, prefs: CalendarPrefs): DayMark[] {
  const jewish = prefs.hebrew ? hebrewWeek(week, lang) : null;
  const extra = faithHolidays(week, addDays(week, 6), lang, { christian: prefs.christian, muslim: prefs.muslim });
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const iso = addDays(week, day);
    return {
      hebrew: jewish?.[day].hebrew ?? "",
      holidays: [...(jewish?.[day].holidays ?? []), ...(extra.get(iso) ?? [])],
    };
  });
}

export function weekHebrewRange(week: string, lang: Lang, prefs: CalendarPrefs): string {
  return prefs.hebrew ? hebrewWeekRange(week, lang) : "";
}

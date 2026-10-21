import { createContext, useContext } from "react";
import type { Lang } from "../domain";
import { formatDayDate, formatWeekRange } from "../schedule/display";
import { hebrewWeek, hebrewWeekRange } from "../schedule/hebrew-calendar";

/** The business setting. Off leaves Gregorian dates only: no Hebrew dates and no holidays. */
export const HebrewCalendarContext = createContext(true);

export function useHebrewCalendar(): boolean {
  return useContext(HebrewCalendarContext);
}

/** Under a day name: the Gregorian date, then the Hebrew date and holidays in small print. */
export function DayDates({ week, day, lang }: { week: string; day: number; lang: Lang }) {
  const hebrew = useHebrewCalendar();
  const info = hebrew ? hebrewWeek(week, lang)[day] : null;
  return (
    <>
      <span className="block text-[11px] font-normal tabular-nums text-subtle">{formatDayDate(week, day, lang)}</span>
      {info ? (
        <>
          <span data-testid={`hebrew-date-${day}`} className="block text-[10px] font-normal leading-tight text-muted">
            {info.hebrew}
          </span>
          {info.holidays.map((holiday) => (
            <span
              key={holiday.name}
              title={holiday.name}
              data-testid={`holiday-${day}`}
              className={`mx-auto mt-0.5 block max-w-full truncate rounded-md px-1.5 text-[10px] font-medium leading-4 ${
                holiday.rest ? "bg-danger-softer text-danger-text" : "bg-brand-soft text-brand-text"
              }`}
            >
              {holiday.name}
            </span>
          ))}
        </>
      ) : null}
    </>
  );
}

/** A week range, with its Hebrew range in small print underneath when the calendar is on. */
export function WeekDates({ week, lang, className = "" }: { week: string; lang: Lang; className?: string }) {
  const hebrew = useHebrewCalendar();
  return (
    <span className={`flex flex-col items-center leading-tight ${className}`}>
      <span>{formatWeekRange(week, lang)}</span>
      {hebrew ? (
        <span data-testid="hebrew-week" className="text-[11px] font-normal text-muted">
          {hebrewWeekRange(week, lang)}
        </span>
      ) : null}
    </span>
  );
}

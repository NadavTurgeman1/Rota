import type { Lang } from "../domain";
import { formatDayDate, formatWeekRange } from "../schedule/display";
import { hebrewWeek, hebrewWeekRange } from "../schedule/hebrew-calendar";

/** Under a day name: the Gregorian date, the Hebrew date in small print, and that day's holidays. */
export function DayDates({ week, day, lang }: { week: string; day: number; lang: Lang }) {
  const info = hebrewWeek(week, lang)[day];
  return (
    <>
      <span className="block text-[11px] font-normal tabular-nums text-subtle">{formatDayDate(week, day, lang)}</span>
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
  );
}

/** A week range with its Hebrew range in small print underneath. */
export function WeekDates({ week, lang, className = "" }: { week: string; lang: Lang; className?: string }) {
  return (
    <span className={`flex flex-col items-center leading-tight ${className}`}>
      <span>{formatWeekRange(week, lang)}</span>
      <span data-testid="hebrew-week" className="text-[11px] font-normal text-muted">
        {hebrewWeekRange(week, lang)}
      </span>
    </span>
  );
}

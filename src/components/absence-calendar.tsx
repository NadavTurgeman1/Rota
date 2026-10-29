import { useMemo, useState } from "react";
import { addDays, clickAbsenceDay, sundayOnOrBefore, type Lang } from "../domain";
import { hebrewDay, hebrewMonthSpan, holidaysBetween, type Holiday } from "../schedule/hebrew-calendar";
import { copy } from "../i18n/copy";
import { useHebrewCalendar } from "./day-dates";

const YEARS_AROUND = 5;

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthStart(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

function Chevron({ forward = false, double = false }: { forward?: boolean; double?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-4 w-4 ${forward ? "" : "-scale-x-100"}`}>
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {double ? <path d="M2 3.5 6.5 8 2 12.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" /> : null}
    </svg>
  );
}

function PillSelect({
  testId,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  testId: string;
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
  disabled: boolean;
}) {
  return (
    <span className="relative inline-flex">
      <select
        data-testid={testId}
        aria-label={label}
        disabled={disabled}
        className="h-8 cursor-pointer appearance-none rounded-lg bg-transparent pe-7 ps-2.5 text-[15px] font-semibold tracking-tight text-ink hover:bg-card focus-visible:bg-card disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute end-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function inRange(day: string, start: string, end: string): boolean {
  return Boolean(start && end && day >= start && day <= end);
}

/** Month calendar: first click is the start day, second click is the last day. Weeks are not selected. */
export function AbsenceCalendar({
  lang,
  start,
  end,
  disabled,
  onChange,
}: {
  lang: Lang;
  start: string;
  end: string;
  disabled: boolean;
  onChange: (range: { start: string; end: string }) => void;
}) {
  const t = copy[lang];
  const [view, setView] = useState(() => monthStart(start || localToday()));
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const hebrew = useHebrewCalendar();

  const first = `${view.year}-${String(view.month).padStart(2, "0")}-01`;
  const gridStart = sundayOnOrBefore(first);
  const days = useMemo(() => Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)), [gridStart]);
  const holidays = useMemo(() => (hebrew ? holidaysBetween(days[0], days[41], lang) : new Map<string, Holiday[]>()), [days, lang, hebrew]);
  const today = localToday();
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1))),
  }));
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 18 + index))),
  );
  const around = Array.from({ length: YEARS_AROUND * 2 + 1 }, (_, index) => monthStart(start || today).year - YEARS_AROUND + index);
  const years = (around.includes(view.year) ? around : [...around, view.year].sort()).map((year) => ({ value: year, label: String(year) }));

  function step(delta: number) {
    setView(({ year, month }) => {
      const total = year * 12 + (month - 1) + delta;
      return { year: Math.floor(total / 12), month: (total % 12) + 1 };
    });
  }

  const navButton = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-card hover:text-ink disabled:opacity-50";

  return (
    <div className="sm:col-span-2">
      <span className="text-sm font-medium text-ink-soft">{t.absencesDays}</span>
      <p className="mt-1 text-xs leading-5 text-muted">{t.absencesDaysHint}</p>
      <div data-testid="absence-calendar" className="mt-3 overflow-hidden rounded-lg border border-line">
        <div dir="ltr" className="border-b border-line bg-well px-2 pb-2 pt-2">
          <div className="flex items-center gap-0.5">
            <button type="button" data-testid="absence-prev-year" aria-label={t.previousYear} className={navButton} disabled={disabled} onClick={() => step(-12)}>
              <Chevron double />
            </button>
            <button type="button" data-testid="absence-prev-month" aria-label={t.previousMonth} className={navButton} disabled={disabled} onClick={() => step(-1)}>
              <Chevron />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <PillSelect testId="absence-month" label={t.monthLabel} value={view.month} options={months} disabled={disabled} onChange={(month) => setView((current) => ({ ...current, month }))} />
              <PillSelect testId="absence-year" label={t.yearLabel} value={view.year} options={years} disabled={disabled} onChange={(year) => setView((current) => ({ ...current, year }))} />
            </div>
            <button type="button" data-testid="absence-next-month" aria-label={t.nextMonth} className={navButton} disabled={disabled} onClick={() => step(1)}>
              <Chevron forward />
            </button>
            <button type="button" data-testid="absence-next-year" aria-label={t.nextYear} className={navButton} disabled={disabled} onClick={() => step(12)}>
              <Chevron forward double />
            </button>
          </div>
          {hebrew ? <p className="mt-0.5 text-center text-xs font-medium text-brand-text">{hebrewMonthSpan(view.year, view.month, lang)}</p> : null}
        </div>

        <div dir={lang === "he" ? "rtl" : "ltr"} className="px-2 pb-2 pt-1">
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-subtle">
            {weekdays.map((name, index) => (
              <span key={index} className="py-1.5">
                {name}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const inMonth = day.startsWith(first.slice(0, 8));
              const events = holidays.get(day) ?? [];
              const rest = events.some((event) => event.rest);
              const names = events.map((event) => event.name).join(" · ");
              const picked = inRange(day, start, end);
              const edge = day === start || day === end;
              return (
                <button
                  key={day}
                  type="button"
                  data-testid={`absence-day-${day}`}
                  disabled={disabled}
                  aria-pressed={picked}
                  title={hebrew ? (names ? `${hebrewDay(day, lang)} · ${names}` : hebrewDay(day, lang)) : undefined}
                  className={`flex ${hebrew ? "h-[3.75rem]" : "h-10"} min-w-0 flex-col items-center justify-start gap-0.5 rounded-xl px-0.5 pt-1 disabled:opacity-50 ${
                    picked ? "bg-brand-soft" : "hover:bg-well"
                  } ${inMonth ? "" : "opacity-35"}`}
                  onClick={() => onChange(clickAbsenceDay(start, end, day))}
                >
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-sm tabular-nums ${
                      day === today
                        ? "bg-brand font-semibold text-on-brand"
                        : edge
                          ? "bg-brand/15 font-semibold text-brand-text"
                          : rest
                            ? "font-semibold text-danger-text"
                            : picked
                              ? "font-semibold text-ink"
                              : "text-ink"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {hebrew ? <span className="text-[10px] leading-none text-muted">{hebrewDay(day, lang).split(" ")[0]}</span> : null}
                  {events.length ? (
                    <span className={`w-full truncate rounded px-0.5 text-[9px] font-medium leading-3 ${rest ? "bg-danger-softer text-danger-text" : "bg-violet-softer text-violet-text"}`}>
                      {events[0].name}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

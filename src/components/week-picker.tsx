"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, sundayOnOrBefore, type Lang } from "../domain";
import { hebrewDay, hebrewMonthSpan, holidaysBetween, type Holiday } from "../schedule/hebrew-calendar";
import { copy } from "../i18n/copy";
import { useHebrewCalendar, WeekDates } from "./day-dates";

const YEARS_AROUND = 5;

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthStart(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

/** Points back in reading order, so it flips in Hebrew. `double` steps a year. */
function Chevron({ forward = false, double = false }: { forward?: boolean; double?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-4 w-4 ${forward ? "rtl:-scale-x-100" : "-scale-x-100 rtl:scale-x-100"}`}>
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
}: {
  testId: string;
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}) {
  return (
    <span className="relative inline-flex">
      <select
        data-testid={testId}
        aria-label={label}
        className="h-8 cursor-pointer appearance-none rounded-lg bg-transparent pe-7 ps-2.5 text-[15px] font-semibold tracking-tight text-ink hover:bg-card focus-visible:bg-card"
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

/** The week range as a button. It opens a month calendar; any day picked opens its whole week. */
export function WeekPicker({ lang, week, onPick, className = "" }: { lang: Lang; week: string; onPick: (sunday: string) => void; className?: string }) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthStart(addDays(week, 3)));
  const [hovered, setHovered] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const hebrew = useHebrewCalendar();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const first = `${view.year}-${String(view.month).padStart(2, "0")}-01`;
  const gridStart = sundayOnOrBefore(first);
  const days = useMemo(() => Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)), [gridStart]);
  const holidays = useMemo(() => (hebrew ? holidaysBetween(days[0], days[41], lang) : new Map<string, Holiday[]>()), [days, lang, hebrew]);
  const monthHolidays = days.filter((day) => day.startsWith(first.slice(0, 8)) && holidays.has(day));
  const today = localToday();
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1))),
  }));
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 18 + index))),
  );
  const around = Array.from({ length: YEARS_AROUND * 2 + 1 }, (_, index) => monthStart(week).year - YEARS_AROUND + index);
  const years = (around.includes(view.year) ? around : [...around, view.year].sort()).map((year) => ({ value: year, label: String(year) }));

  function step(delta: number) {
    setView(({ year, month }) => {
      const total = year * 12 + (month - 1) + delta;
      return { year: Math.floor(total / 12), month: (total % 12) + 1 };
    });
  }

  function pick(day: string) {
    onPick(sundayOnOrBefore(day));
    setOpen(false);
  }

  function toggle() {
    if (!open) setView(monthStart(addDays(week, 3)));
    setHovered(null);
    setOpen(!open);
  }

  const navButton = "grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft hover:bg-card hover:text-ink";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="week-range"
        aria-label={t.pickWeek}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`min-w-36 rounded-lg px-2 py-0.5 text-center text-sm font-semibold tabular-nums hover:bg-well ${className}`}
        onClick={toggle}
      >
        <WeekDates week={week} lang={lang} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t.pickWeek}
          data-testid="week-picker"
          className="pop-in pop-in-center material-pop absolute -start-9 top-full z-40 mt-2 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line shadow-pop"
        >
          <div className="border-b border-line bg-well px-2 pb-2 pt-2">
            <div className="flex items-center gap-0.5">
              <button type="button" data-testid="picker-prev-year" aria-label={t.previousYear} className={navButton} onClick={() => step(-12)}>
                <Chevron double />
              </button>
              <button type="button" data-testid="picker-prev-month" aria-label={t.previousMonth} className={navButton} onClick={() => step(-1)}>
                <Chevron />
              </button>
              <div className="flex min-w-0 flex-1 items-center justify-center">
                <PillSelect testId="picker-month" label={t.monthLabel} value={view.month} options={months} onChange={(month) => setView((current) => ({ ...current, month }))} />
                <PillSelect testId="picker-year" label={t.yearLabel} value={view.year} options={years} onChange={(year) => setView((current) => ({ ...current, year }))} />
              </div>
              <button type="button" data-testid="picker-next-month" aria-label={t.nextMonth} className={navButton} onClick={() => step(1)}>
                <Chevron forward />
              </button>
              <button type="button" data-testid="picker-next-year" aria-label={t.nextYear} className={navButton} onClick={() => step(12)}>
                <Chevron forward double />
              </button>
            </div>
            {hebrew ? <p className="mt-0.5 text-center text-xs font-medium text-brand-text">{hebrewMonthSpan(view.year, view.month, lang)}</p> : null}
          </div>

          <div className="px-2 pb-2 pt-1" onMouseLeave={() => setHovered(null)}>
            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-subtle">
              {weekdays.map((name, index) => (
                <span key={index} className="py-1.5">
                  {name}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {Array.from({ length: 6 }, (_, row) => {
                const sunday = days[row * 7];
                const current = sunday === week;
                return (
                  <div
                    key={sunday}
                    data-testid={`picker-week-${sunday}`}
                    onMouseEnter={() => setHovered(sunday)}
                    className={`grid grid-cols-7 rounded-xl transition-colors ${current ? "bg-brand-soft ring-1 ring-inset ring-brand/30" : "hover:bg-well"}`}
                  >
                    {days.slice(row * 7, row * 7 + 7).map((day) => {
                      const inMonth = day.startsWith(first.slice(0, 8));
                      const events = holidays.get(day) ?? [];
                      const rest = events.some((event) => event.rest);
                      const names = events.map((event) => event.name).join(" · ");
                      return (
                        <button
                          key={day}
                          type="button"
                          data-testid={`picker-day-${day}`}
                          title={hebrew ? (names ? `${hebrewDay(day, lang)} · ${names}` : hebrewDay(day, lang)) : undefined}
                          className={`flex ${hebrew ? "h-[3.75rem]" : "h-10"} min-w-0 flex-col items-center justify-start gap-0.5 rounded-xl px-0.5 pt-1 ${inMonth ? "" : "opacity-35"}`}
                          onClick={() => pick(day)}
                        >
                          <span
                            className={`grid h-6 w-6 place-items-center rounded-full text-sm tabular-nums ${
                              day === today ? "bg-brand font-semibold text-on-brand" : rest ? "font-semibold text-danger-text" : current ? "font-semibold text-ink" : "text-ink"
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
                );
              })}
            </div>
          </div>

          {monthHolidays.length ? (
            <ul data-testid="picker-holidays" className="mx-2 mb-2 flex max-h-28 flex-col gap-1 overflow-y-auto rounded-xl bg-well px-2.5 py-2 text-xs">
              {monthHolidays.map((day) => (
                <li key={day} className="flex gap-2">
                  <span className="w-10 shrink-0 tabular-nums text-muted">{`${Number(day.slice(8))}.${Number(day.slice(5, 7))}`}</span>
                  <span className={holidays.get(day)?.some((event) => event.rest) ? "font-medium text-danger-text" : "text-ink-soft"}>
                    {holidays.get(day)?.map((event) => event.name).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex items-center gap-2 border-t border-line px-3 py-2">
            <WeekDates week={hovered ?? week} lang={lang} className="min-w-0 flex-1 !items-start text-xs font-semibold text-ink" />
            <button
              type="button"
              data-testid="picker-this-week"
              className="h-8 shrink-0 rounded-lg border border-line bg-card px-3 text-xs font-medium text-ink hover:bg-well"
              onClick={() => pick(today)}
            >
              {t.thisWeek}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, sundayOnOrBefore, type Lang } from "../domain";
import { formatWeekRange } from "../schedule/display";
import { hebrewDay, hebrewMonthSpan, holidaysBetween } from "../schedule/hebrew-calendar";
import { copy } from "../i18n/copy";

const YEARS_AROUND = 5;

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function monthStart(iso: string): { year: number; month: number } {
  const [year, month] = iso.split("-").map(Number);
  return { year, month };
}

/** The week range as a button. It opens a month calendar; any day picked opens its whole week. */
export function WeekPicker({ lang, week, onPick, className = "" }: { lang: Lang; week: string; onPick: (sunday: string) => void; className?: string }) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthStart(addDays(week, 3)));
  const root = useRef<HTMLDivElement>(null);
  const locale = lang === "he" ? "he-IL" : "en-GB";

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
  const holidays = useMemo(() => holidaysBetween(days[0], days[41], lang), [days, lang]);
  const monthHolidays = days.filter((day) => day.startsWith(first.slice(0, 8)) && holidays.has(day));
  const today = localToday();
  const months = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, index, 1))),
  );
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 18 + index))),
  );
  const years = Array.from({ length: YEARS_AROUND * 2 + 1 }, (_, index) => monthStart(week).year - YEARS_AROUND + index);

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
    setOpen(!open);
  }

  const navButton = "grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-ink-soft hover:bg-well hover:text-ink";
  const pickerSelect = "h-8 rounded-lg border border-line bg-card px-2 text-sm text-ink hover:border-field-line";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="week-range"
        aria-label={t.pickWeek}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`min-w-36 rounded-lg px-2 py-1 text-center text-sm font-semibold tabular-nums hover:bg-well ${className}`}
        onClick={toggle}
      >
        {formatWeekRange(week, lang)}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t.pickWeek}
          data-testid="week-picker"
          className="absolute -start-9 top-full z-40 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-3 shadow-card"
        >
          <div className="flex items-center gap-1">
            <button type="button" data-testid="picker-prev-month" aria-label={t.previousMonth} className={navButton} onClick={() => step(-1)}>
              ‹
            </button>
            <select
              data-testid="picker-month"
              aria-label={t.monthLabel}
              className={`${pickerSelect} min-w-0 flex-1`}
              value={view.month}
              onChange={(event) => setView((current) => ({ ...current, month: Number(event.target.value) }))}
            >
              {months.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              data-testid="picker-year"
              aria-label={t.yearLabel}
              className={pickerSelect}
              value={view.year}
              onChange={(event) => setView((current) => ({ ...current, year: Number(event.target.value) }))}
            >
              {(years.includes(view.year) ? years : [...years, view.year].sort()).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <button type="button" data-testid="picker-next-month" aria-label={t.nextMonth} className={navButton} onClick={() => step(1)}>
              ›
            </button>
          </div>
          <p className="mt-1 text-center text-xs text-muted">{hebrewMonthSpan(view.year, view.month, lang)}</p>

          <div className="mt-2 grid grid-cols-7 text-center text-xs font-medium text-muted">
            {weekdays.map((name, index) => (
              <span key={index} className="py-1">
                {name}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: 6 }, (_, row) => {
              const sunday = days[row * 7];
              const current = sunday === week;
              return (
                <div
                  key={sunday}
                  data-testid={`picker-week-${sunday}`}
                  className={`grid grid-cols-7 rounded-lg ${current ? "bg-brand-soft" : "hover:bg-well"}`}
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
                        title={names ? `${hebrewDay(day, lang)} · ${names}` : hebrewDay(day, lang)}
                        className={`flex h-14 min-w-0 flex-col items-center justify-start gap-0.5 rounded-lg px-0.5 pt-1 ${inMonth ? "" : "opacity-40"}`}
                        onClick={() => pick(day)}
                      >
                        <span
                          className={`grid h-6 w-6 place-items-center rounded-full text-sm tabular-nums ${
                            day === today ? "bg-brand font-semibold text-on-brand" : rest ? "font-semibold text-danger-text" : "text-ink"
                          }`}
                        >
                          {Number(day.slice(8))}
                        </span>
                        <span className="text-[10px] leading-none text-muted">{hebrewDay(day, lang).split(" ")[0]}</span>
                        {events.length ? (
                          <span className={`w-full truncate text-[9px] leading-tight ${rest ? "text-danger-text" : "text-brand-text"}`}>{events[0].name}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {monthHolidays.length ? (
            <ul data-testid="picker-holidays" className="mt-3 flex max-h-28 flex-col gap-1 overflow-y-auto border-t border-line pt-2 text-xs">
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

          <div className="mt-3 flex justify-end border-t border-line pt-2">
            <button type="button" data-testid="picker-this-week" className="h-8 rounded-lg border border-line bg-card px-3 text-xs text-ink hover:bg-well" onClick={() => pick(today)}>
              {t.thisWeek}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

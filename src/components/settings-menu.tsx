"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import type { CalendarPrefs } from "../schedule/shown-calendars";
import { LegalLinks } from "./legal-links";
import { button } from "./ui";

export type Theme = "light" | "dark";

/** Gear button holding the display preferences, plus sign-out once someone is signed in. */
export function SettingsMenu({
  lang,
  theme,
  calendars,
  onLang,
  onTheme,
  onCalendar,
  onSignOut,
  onDeleteData,
}: {
  lang: Lang;
  theme: Theme;
  calendars: CalendarPrefs;
  onLang: (lang: Lang) => void;
  onTheme: (theme: Theme) => void;
  onCalendar: (key: keyof CalendarPrefs, on: boolean) => void;
  onSignOut?: () => void;
  onDeleteData?: () => void;
}) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        data-testid="settings"
        aria-label={t.settings}
        title={t.settings}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={button.icon}
        onClick={() => setOpen((current) => !current)}
      >
        <GearIcon open={open} />
      </button>
      {open ? (
        <div
          ref={panel}
          role="dialog"
          aria-label={t.settings}
          tabIndex={-1}
          data-testid="settings-panel"
          className="pop-in material-pop absolute end-0 top-full z-40 mt-2 w-80 rounded-lg border border-line p-3 shadow-pop outline-none"
        >
          <Group title={t.appearance}>
            <Segment
              testId="theme"
              options={[
                { value: "light", label: t.lightShort, icon: <SunIcon /> },
                { value: "dark", label: t.darkShort, icon: <MoonIcon /> },
              ]}
              value={theme}
              onChange={(value) => onTheme(value as Theme)}
            />
          </Group>
          <Group title={t.language}>
            <Segment
              testId="lang"
              columns={3}
              options={[
                { value: "he", label: t.hebrew, lang: "he" },
                { value: "en", label: t.english, lang: "en" },
                { value: "ru", label: t.russian, lang: "ru" },
              ]}
              value={lang}
              onChange={(value) => onLang(value as Lang)}
            />
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs font-semibold text-muted">{t.calendars}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{t.calendarsHint}</p>
              <Switch testId="calendar-hebrew" label={t.hebrewCalendar} on={calendars.hebrew} onChange={(on) => onCalendar("hebrew", on)} />
              <Switch testId="calendar-christian" label={t.christianHolidays} on={calendars.christian} onChange={(on) => onCalendar("christian", on)} />
              <Switch testId="calendar-muslim" label={t.muslimHolidays} on={calendars.muslim} onChange={(on) => onCalendar("muslim", on)} />
            </div>
          </Group>
          <div className="mt-3 border-t border-line pt-3">
            <LegalLinks lang={lang} />
          </div>
          {onDeleteData ? (
            <div className="mt-3 border-t border-line pt-3">
              <button
                type="button"
                data-testid="delete-data"
                className={`${button.quiet} w-full shadow-none`}
                onClick={() => {
                  setOpen(false);
                  onDeleteData();
                }}
              >
                {t.deleteData}
              </button>
            </div>
          ) : null}
          {onSignOut ? (
            <div className="mt-3 border-t border-line pt-3">
              <button type="button" data-testid="sign-out" className={`${button.quiet} w-full shadow-none`} onClick={onSignOut}>
                {t.signOut}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-0" role="group" aria-label={title}>
      <p className="mb-1.5 text-xs font-semibold text-muted">{title}</p>
      {children}
    </div>
  );
}

function Switch({ testId, label, on, onChange }: { testId: string; label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      data-testid={testId}
      aria-checked={on}
      className="mt-2 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      onClick={() => onChange(!on)}
    >
      <span className="text-sm text-ink">{label}</span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full ${on ? "bg-brand" : "bg-track"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-card ${on ? "end-0.5" : "start-0.5"}`} />
      </span>
    </button>
  );
}

function Segment({
  testId,
  options,
  value,
  onChange,
  columns = 2,
}: {
  testId: string;
  options: { value: string; label: string; icon?: ReactNode; lang?: Lang }[];
  value: string;
  onChange: (value: string) => void;
  columns?: 2 | 3;
}) {
  return (
    <div className={`grid gap-1 rounded-xl border border-line bg-track p-1 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.lang}
          data-testid={`${testId}-${option.value}`}
          aria-pressed={value === option.value}
          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg text-sm font-medium ${
            value === option.value ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink"
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function GearIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-5 w-5 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${open ? "rotate-45" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.2a1.7 1.7 0 0 1 3.4 0l.1.8a1.7 1.7 0 0 0 2.5 1.1l.7-.4a1.7 1.7 0 0 1 2.4 2.4l-.4.7a1.7 1.7 0 0 0 1.1 2.5l.8.1a1.7 1.7 0 0 1 0 3.4l-.8.1a1.7 1.7 0 0 0-1.1 2.5l.4.7a1.7 1.7 0 0 1-2.4 2.4l-.7-.4a1.7 1.7 0 0 0-2.5 1.1l-.1.8a1.7 1.7 0 0 1-3.4 0l-.1-.8a1.7 1.7 0 0 0-2.5-1.1l-.7.4a1.7 1.7 0 0 1-2.4-2.4l.4-.7a1.7 1.7 0 0 0-1.1-2.5l-.8-.1a1.7 1.7 0 0 1 0-3.4l.8-.1a1.7 1.7 0 0 0 1.1-2.5l-.4-.7a1.7 1.7 0 0 1 2.4-2.4l.7.4a1.7 1.7 0 0 0 2.5-1.1Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a6.8 6.8 0 1 0 8.7 8.7Z" />
    </svg>
  );
}

"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { addDays, dayName, roleNames, shiftKind, type Lang, type RotaState } from "../domain";
import { formatDuration, formatWhen } from "../attendance/sessions";
import { copy } from "../i18n/copy";
import { employeeName } from "../people/edit";
import { formatDayDate, shiftLabel } from "../schedule/display";
import { screenCopy } from "../insights/copy";
import { clockOutAfter, peopleOnSite, weekAttendance, zonedDate, type ArrivalRow, type ClockPunch, type DayShift } from "../insights/report";

const DOT: Record<ReturnType<typeof shiftKind>, string> = {
  m: "bg-shift-m",
  a: "bg-shift-a",
  n: "bg-shift-n",
};

const FILL: Record<ReturnType<typeof shiftKind>, string> = {
  m: "bg-slot-m",
  a: "bg-slot-a",
  n: "bg-slot-n",
};

const STICKY = "sticky start-0 z-10 bg-card before:absolute before:-inset-1 before:-z-10 before:bg-card before:content-['']";
const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function DashboardScreen({
  state,
  lang,
  timeZone,
  punches,
  clocks,
  onOpenEmployee,
}: {
  state: RotaState;
  lang: Lang;
  timeZone: string;
  punches: ClockPunch[] | null;
  clocks: "loading" | "missing" | "ready";
  onOpenEmployee?: (employeeId: string) => void;
}) {
  const t = screenCopy[lang];
  const ui = copy[lang];
  const now = useMinute();
  const today = zonedDate(now, timeZone);
  const floorRef = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState("all");
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const [pickedShift, setPickedShift] = useState<string | null>(null);
  useEffect(() => {
    setPickedDay(null);
    setPickedShift(null);
  }, [state.week]);
  useEffect(() => {
    const root = scroller.current;
    const column = root?.querySelector<HTMLElement>("[data-today]");
    if (!root || !column || root.scrollWidth <= root.clientWidth) return;
    column.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [state.week, today]);

  const rows = useMemo(() => weekAttendance(state, timeZone, now, punches), [state, timeZone, now, punches]);
  const roles = useMemo(
    () => roleNames([...(state.biz.roles ?? []), ...state.biz.shifts.map((shift) => shift.role)]),
    [state.biz.roles, state.biz.shifts],
  );
  const visibleShifts = state.biz.shifts.filter((shift) => role === "all" || shift.role.trim().toLowerCase() === role.trim().toLowerCase());
  const todayDay = DAYS.find((day) => addDays(state.week, day) === today);
  const activeDay = pickedDay ?? todayDay ?? 0;
  const activeShift = pickedShift && visibleShifts.some((shift) => shift.id === pickedShift) ? pickedShift : null;
  const onSite = punches ? peopleOnSite(punches, now) : [];

  function scrollFloor() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    floorRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }

  return (
    <div data-testid="dashboard-screen" className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="max-w-3xl text-sm leading-6 text-muted">{t.dashboardHint}</p>
        {roles.length > 0 ? (
          <div role="tablist" aria-label={t.allShifts} className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-card p-1">
            <RoleTab id="all" label={t.allShifts} pressed={role === "all"} onClick={() => setRole("all")} />
            {roles.map((name) => (
              <RoleTab key={name} id={name} label={name} pressed={role.trim().toLowerCase() === name.trim().toLowerCase()} onClick={() => setRole(name)} />
            ))}
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? <p className="text-sm text-muted">{t.noSchedule}</p> : null}

      <div className="min-w-0 rounded-xl border border-line bg-card p-1.5 shadow-card sm:p-2">
        <p className="mb-2 px-1 text-xs text-subtle lg:hidden">{ui.scrollHint}</p>
        {visibleShifts.length === 0 ? <p className="px-2 py-4 text-sm text-muted">{t.noRoleShifts}</p> : null}
        <div ref={scroller} className="overflow-x-auto lg:overflow-x-hidden">
          <div role="grid" className="dash-week">
            <div role="columnheader" className={STICKY} />
            {DAYS.map((day) => {
              const isToday = addDays(state.week, day) === today;
              const pressed = activeDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  role="columnheader"
                  data-today={isToday ? "true" : undefined}
                  aria-pressed={pressed}
                  className={`min-w-0 rounded-md px-0.5 py-1 text-center text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-focus ${
                    pressed ? "bg-brand text-on-brand" : isToday ? "bg-brand-soft text-brand-text" : "text-muted hover:bg-well"
                  }`}
                  onClick={() => {
                    setPickedDay(day);
                    setPickedShift(null);
                    scrollFloor();
                  }}
                >
                  <span className="block truncate">{dayName(day, lang)}</span>
                  <span className={`block text-[10px] font-normal tabular-nums ${pressed ? "text-on-brand" : isToday ? "text-brand-text" : "text-subtle"}`}>
                    {formatDayDate(state.week, day, lang)}
                  </span>
                </button>
              );
            })}
            {visibleShifts.map((shift) => {
              const kind = shiftKind(shift.start, shift.end);
              return (
                <Fragment key={shift.id}>
                  <div role="rowheader" className={`${STICKY} px-1 py-0.5 text-start`}>
                    <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-4 text-ink">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[kind]}`} aria-hidden="true" />
                      <span className="truncate">{shiftLabel(shift.name, lang)}</span>
                    </span>
                    <span dir="ltr" className="block truncate text-[10px] font-normal tabular-nums leading-4 text-muted">
                      {shift.start}–{shift.end}
                    </span>
                  </div>
                  {DAYS.map((day) => {
                    const row = rows.find((item) => item.day === day && item.shiftId === shift.id);
                    const isToday = addDays(state.week, day) === today;
                    const selected = activeShift === shift.id && activeDay === day;
                    if (!row) {
                      return (
                        <div key={day} role="gridcell" className="min-w-0">
                          <div className="flex min-h-8 items-center justify-center rounded-md border border-dashed border-line text-[10px] font-medium text-subtle">
                            {ui.closed}
                          </div>
                        </div>
                      );
                    }
                    const extra = Math.max(0, row.people.length - 2);
                    return (
                      <div key={day} role="gridcell" className="min-w-0">
                        <button
                          type="button"
                          data-testid={`dash-cell-${day}-${shift.name}`}
                          aria-pressed={selected}
                          className={`flex w-full min-h-8 flex-col items-start gap-0 rounded-md border px-1 py-0.5 text-start focus-visible:ring-2 focus-visible:ring-focus ${FILL[kind]} ${
                            selected ? "border-brand ring-2 ring-brand" : isToday ? "border-brand" : "border-line hover:border-field-line"
                          }`}
                          onClick={() => {
                            setPickedDay(day);
                            setPickedShift(shift.id);
                            scrollFloor();
                          }}
                        >
                          {row.people.slice(0, 2).map((person) => (
                            <span key={person.employeeId} className="block w-full truncate text-[10px] leading-4 text-ink">
                              {person.name}
                            </span>
                          ))}
                          {extra > 0 ? <span className="text-[10px] leading-4 text-muted">+{extra}</span> : null}
                          {row.people.length === 0 ? <span className="text-[10px] leading-4 text-subtle">—</span> : null}
                        </button>
                      </div>
                    );
                  })}
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <section ref={floorRef} className="dash-rise flex flex-col gap-4 rounded-2xl border border-line bg-paper p-3 sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight text-ink">{t.onSite}</h2>
          <span className="text-2xl font-semibold tabular-nums leading-none text-ink">{clocks === "ready" ? onSite.length : "—"}</span>
        </div>
        {clocks !== "ready" ? <p className="text-sm text-muted">{clocks === "loading" ? t.loadingClocks : t.clocksMissing}</p> : null}
        {clocks === "ready" && onSite.length === 0 ? <p className="text-sm text-muted">{t.onSiteEmpty}</p> : null}
        {clocks === "ready" && onSite.length > 0 ? (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {onSite.map((person, index) => (
              <li key={person.employeeId} className="dash-rise" style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}>
                <OnSiteChip
                  name={employeeName(state, person.employeeId)}
                  punchedAt={person.punchedAt}
                  now={now}
                  lang={lang}
                  timeZone={timeZone}
                  onOpen={onOpenEmployee ? () => onOpenEmployee(person.employeeId) : undefined}
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-ink">{t.floorTitle}</h2>
            <span className="text-sm text-muted">
              {dayName(activeDay, lang)} · {formatDayDate(state.week, activeDay, lang)}
            </span>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {DAYS.map((day) => {
              const isToday = addDays(state.week, day) === today;
              const pressed = activeDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={pressed}
                  className={`h-9 shrink-0 rounded-lg px-3 text-sm focus-visible:ring-2 focus-visible:ring-focus ${
                    pressed ? "bg-brand font-medium text-on-brand" : isToday ? "bg-brand-soft text-brand-text" : "bg-card text-ink hover:bg-well"
                  }`}
                  onClick={() => {
                    setPickedDay(day);
                    setPickedShift(null);
                  }}
                >
                  {dayName(day, lang)}
                </button>
              );
            })}
          </div>
          {visibleShifts.length === 0 ? <p className="text-sm text-muted">{t.noRoleShifts}</p> : null}
          {visibleShifts.length > 0 && !rows.some((row) => row.day === activeDay && visibleShifts.some((shift) => shift.id === row.shiftId)) ? (
            <p className="text-sm text-muted">{t.dayEmpty}</p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleShifts.map((shift, index) => {
              const row = rows.find((item) => item.day === activeDay && item.shiftId === shift.id);
              if (!row) return null;
              const kind = shiftKind(shift.start, shift.end);
              const selected = activeShift === shift.id;
              return (
                <ShiftFloor
                  key={shift.id}
                  shiftName={shiftLabel(shift.name, lang)}
                  rawName={shift.name}
                  role={shift.role}
                  start={shift.start}
                  end={shift.end}
                  kind={kind}
                  row={row}
                  selected={selected}
                  punches={punches}
                  onSiteIds={new Set(onSite.map((person) => person.employeeId))}
                  lang={lang}
                  timeZone={timeZone}
                  delay={Math.min(index, 6) * 70}
                  onOpen={onOpenEmployee}
                  onSelect={() => {
                    setPickedDay(activeDay);
                    setPickedShift(shift.id);
                  }}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function RoleTab({ id, label, pressed, onClick }: { id: string; label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={pressed}
      data-testid={id === "all" ? "dash-role-all" : `dash-role-${label}`}
      className={`h-8 shrink-0 rounded-md px-3 text-sm focus-visible:ring-2 focus-visible:ring-focus ${
        pressed ? "bg-brand font-medium text-on-brand" : "text-muted hover:bg-well hover:text-ink"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function OnSiteChip({
  name,
  punchedAt,
  now,
  lang,
  timeZone,
  onOpen,
}: {
  name: string;
  punchedAt: string;
  now: Date;
  lang: Lang;
  timeZone: string;
  onOpen?: () => void;
}) {
  const t = screenCopy[lang];
  const time = formatWhen(punchedAt, timeZone, lang).time;
  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ok-soft text-sm font-semibold text-ok-text" aria-hidden="true">
        {name.trim().slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{name}</span>
        <span className="block text-xs text-muted">
          <span dir="ltr" className="tabular-nums">{time}</span>
          <span> · {formatDuration(punchedAt, now.toISOString(), lang)}</span>
        </span>
      </span>
      <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok-text">{t.stillHere}</span>
    </>
  );
  const className = "flex w-64 items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-start shadow-card";
  if (!onOpen) return <div className={className}>{body}</div>;
  return (
    <button type="button" className={`${className} hover:border-field-line focus-visible:ring-2 focus-visible:ring-focus`} onClick={onOpen}>
      {body}
    </button>
  );
}

function ShiftFloor({
  shiftName,
  rawName,
  role,
  start,
  end,
  kind,
  row,
  selected,
  punches,
  onSiteIds,
  lang,
  timeZone,
  delay,
  onOpen,
  onSelect,
}: {
  shiftName: string;
  rawName: string;
  role: string;
  start: string;
  end: string;
  kind: ReturnType<typeof shiftKind>;
  row: DayShift;
  selected: boolean;
  punches: ClockPunch[] | null;
  onSiteIds: Set<string>;
  lang: Lang;
  timeZone: string;
  delay: number;
  onOpen?: (employeeId: string) => void;
  onSelect: () => void;
}) {
  const t = screenCopy[lang];
  const clocked = row.clocked;
  const short = clocked !== null && clocked < row.required;
  const met = clocked !== null && clocked >= row.required;
  return (
    <article
      className={`dash-rise flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-card ${selected ? "border-brand ring-2 ring-brand" : "border-line"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <button type="button" className="flex items-start justify-between gap-3 text-start focus-visible:ring-2 focus-visible:ring-focus" onClick={onSelect}>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[kind]}`} aria-hidden="true" />
            <span className="truncate">{shiftName}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span dir="ltr" className="tabular-nums">{start}–{end}</span>
            {role ? <span>{role}</span> : null}
          </span>
        </span>
        <span className="text-end">
          <span
            data-testid={`dash-count-${row.day}-${rawName}`}
            className={`block text-2xl font-semibold tabular-nums leading-none ${short ? "text-danger-text" : met ? "text-ok-text" : "text-ink"}`}
          >
            {clocked === null ? "—" : clocked}
            <span className="text-sm font-medium text-muted">/{row.required}</span>
          </span>
          <span className="text-[11px] text-muted">{t.entered}</span>
        </span>
      </button>
      {row.people.length === 0 ? <p className="text-sm text-muted">{t.noAssigned}</p> : null}
      <ul className="flex flex-col gap-1.5">
        {row.people.map((person) => (
          <FloorPerson
            key={person.employeeId}
            person={person}
            outAt={person.punchedAt && punches ? clockOutAfter(punches, person.employeeId, person.punchedAt) : null}
            here={onSiteIds.has(person.employeeId)}
            lang={lang}
            timeZone={timeZone}
            onOpen={onOpen ? () => onOpen(person.employeeId) : undefined}
          />
        ))}
      </ul>
    </article>
  );
}

function FloorPerson({
  person,
  outAt,
  here,
  lang,
  timeZone,
  onOpen,
}: {
  person: ArrivalRow;
  outAt: string | null;
  here: boolean;
  lang: Lang;
  timeZone: string;
  onOpen?: () => void;
}) {
  const t = screenCopy[lang];
  const inn = person.punchedAt ? formatWhen(person.punchedAt, timeZone, lang).time : "";
  const out = outAt ? formatWhen(outAt, timeZone, lang).time : "";
  const note =
    person.arrival === "early" ? t.early(person.minutes) : person.arrival === "late" ? t.late(person.minutes) : person.arrival === "missing" ? t.missing : "";
  const absence = person.arrival === "absent" ? (person.absence === "vacation" ? t.vacation : t.sick) : "";
  const noteTone = person.arrival === "late" || person.arrival === "missing" ? "bg-danger-soft text-danger-text" : "bg-warn-soft text-warn-text";
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg bg-well px-2 py-1.5">
      {onOpen ? (
        <button type="button" data-testid={`dash-open-${person.employeeId}`} className="min-w-0 flex-1 truncate text-start text-sm font-medium text-ink hover:underline focus-visible:ring-2 focus-visible:ring-focus" onClick={onOpen}>
          {person.name}
        </button>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{person.name}</span>
      )}
      {inn ? (
        <span className="text-xs text-muted">
          {t.clockIn} <span dir="ltr" className="tabular-nums">{inn}</span>
        </span>
      ) : null}
      {out ? (
        <span className="text-xs text-muted">
          {t.clockOut} <span dir="ltr" className="tabular-nums">{out}</span>
        </span>
      ) : null}
      {!out && here && inn ? <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok-text">{t.stillHere}</span> : null}
      {absence ? <span className="rounded-full bg-well px-2 py-0.5 text-[11px] font-medium text-ink-soft">{absence}</span> : null}
      {note ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${noteTone}`}>{note}</span> : null}
    </li>
  );
}

import { useEffect, useRef, useState } from "react";
import { addDays, type Lang, type RotaState } from "../domain";
import { isRelief } from "../domain/relief";
import { copy } from "../i18n/copy";
import type { LineOverride } from "../parser";
import { availabilitySubmitted, blockLimitOf, countBlocks, gridWithCell, hasConstraintGrant, withinBlockLimit } from "../people/edit";
import { extensionStillOpen } from "../schedule/constraint-window";
import type { StaffRequest } from "../workspace/workspace";
import { ConstraintPaste } from "./constraint-paste";
import { DurationWheels, useCountdown } from "./duration-wheel";
import { NameRail } from "./name-rail";
import { WeekGrid } from "./team-screen";
import { button, card, cardTitle, pill } from "./ui";

export function ConstraintsScreen({
  state,
  lang,
  siteId,
  canWrite,
  aiEnabled,
  requests,
  onAvailability,
  onWholeAvailability,
  onCopy,
  onApply,
  onDecide,
  onGrant,
}: {
  state: RotaState;
  lang: Lang;
  siteId: string;
  canWrite: boolean;
  aiEnabled: boolean;
  requests: StaffRequest[];
  onAvailability: (employeeId: string, day: number, shiftId: string, available: boolean) => void;
  onWholeAvailability: (employeeId: string, available: boolean) => void;
  onCopy: (employeeId: string) => void;
  onApply: (raw: string, overrides: LineOverride[]) => void;
  onDecide: (requestId: string, approve: boolean) => void;
  onGrant: (employeeId: string, allowed: boolean) => void;
}) {
  const t = copy[lang];
  const ordered = [...state.emps.filter((employee) => employee.active), ...state.emps.filter((employee) => !employee.active)];
  const people = ordered.filter((employee) => !isRelief(employee, siteId));
  const relief = ordered.filter((employee) => isRelief(employee, siteId));
  const everyone = [...people, ...relief];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refused, setRefused] = useState(false);
  const selected = everyone.find((employee) => employee.id === selectedId) ?? null;
  const submitted = everyone.filter((employee) => availabilitySubmitted(state, employee.id)).length;
  const pending = requests.filter((request) => request.week === state.week);

  return (
    <div data-testid="constraints-screen" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <section className="rounded-xl border border-line bg-card p-2">
        <NameRail
          lang={lang}
          testId="roster"
          selectedId={selected?.id ?? null}
          onSelect={(id) => {
            setRefused(false);
            setSelectedId((current) => (current === id ? null : id));
          }}
          people={people.map((item) => ({
            id: item.id,
            name: item.name,
            hint: item.active ? item.role : t.inactive,
            submitted:
              availabilitySubmitted(state, item.id) ||
              requests.some((request) => request.employeeId === item.id && request.week === state.week),
          }))}
          trailing={{
            title: t.reliefRoster,
            people: relief.map((item) => ({
              id: item.id,
              name: item.name,
              hint: item.active ? item.role : t.inactive,
              submitted:
                availabilitySubmitted(state, item.id) ||
                requests.some((request) => request.employeeId === item.id && request.week === state.week),
            })),
          }}
        />
      </section>
      <div className="flex min-w-0 flex-col gap-6">
        {canWrite ? <ConstraintPaste state={state} lang={lang} aiEnabled={aiEnabled} onApply={onApply} /> : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span data-testid="submitted-count" className="font-semibold tabular-nums text-ink">
            {submitted}/{everyone.length} {t.submittedCount}
          </span>
          <span>{t.availabilityLocked}</span>
          <ul className="flex flex-wrap gap-2">
            <li className={`${pill} bg-brand-soft text-ink`}>{t.availableWeek}</li>
            <li className={`${pill} bg-danger-soft text-danger-text`}>{t.unavailableWeek}</li>
            <li className={`${pill} border border-line bg-well text-ink`}>{t.agreementForbids}</li>
            <li className={`${pill} bg-well-strong text-ink`}>{t.siteClosed}</li>
          </ul>
        </div>
        {pending.map((request) => {
          const person = state.emps.find((employee) => employee.id === request.employeeId);
          if (!person) return null;
          const preview: RotaState = {
            ...state,
            avail: {
              ...state.avail,
              [request.week]: { ...state.avail[request.week], [request.employeeId]: request.shifts },
            },
          };
          return (
            <section key={request.id} data-testid={`request-${person.name}`} className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={cardTitle}>
                  {t.staffRequestTitle} · {person.name}
                </h2>
                <span className={`${pill} bg-well text-muted`}>{t.staffPending}</span>
                {canWrite ? (
                  <div className="ms-auto flex gap-2">
                    <button type="button" data-testid={`approve-request-${person.name}`} className={button.primary} onClick={() => onDecide(request.id, true)}>
                      {t.approveRequest}
                    </button>
                    <button type="button" data-testid={`reject-request-${person.name}`} className={button.quiet} onClick={() => onDecide(request.id, false)}>
                      {t.rejectRequest}
                    </button>
                  </div>
                ) : null}
              </div>
              <WeekGrid state={preview} lang={lang} employeeId={person.id} mode="availability" editable={false} onToggle={() => undefined} />
            </section>
          );
        })}
        {everyone.length === 0 ? <p className={`${card} text-sm text-muted`}>{t.noEmployees}</p> : null}
        {everyone.length > 0 && !selected ? <p className={`${card} text-sm text-muted`}>{t.pickEmployee}</p> : null}
        {selected ? (
          <section data-testid={`availability-card-${selected.name}`} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cardTitle}>{selected.name}</h2>
              <span className={`${pill} ${availabilitySubmitted(state, selected.id) ? "bg-ok-soft text-ok-text" : "bg-well text-muted"}`}>
                {availabilitySubmitted(state, selected.id) ? t.submittedShort : t.notSubmittedShort}
              </span>
              {selected.active ? null : <span className="text-xs font-medium text-subtle">{t.inactive}</span>}
              <div className="ms-auto flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid={`mark-all-${selected.name}`}
                  className={button.small}
                  disabled={!canWrite}
                  onClick={() => {
                    setRefused(false);
                    onWholeAvailability(selected.id, true);
                  }}
                >
                  {t.markAll}
                </button>
                <button
                  type="button"
                  data-testid={`clear-all-${selected.name}`}
                  className={button.small}
                  disabled={!canWrite}
                  onClick={() => {
                    const cleared = [[], [], [], [], [], [], []];
                    if (!withinBlockLimit(state, selected.id, cleared)) {
                      setRefused(true);
                      return;
                    }
                    setRefused(false);
                    onWholeAvailability(selected.id, false);
                  }}
                >
                  {t.clearEverything}
                </button>
                <button
                  type="button"
                  data-testid={`copy-availability-${selected.name}`}
                  className={button.quiet}
                  disabled={!canWrite}
                  onClick={() => {
                    const previous = state.avail[addDays(state.week, -7)]?.[selected.id];
                    if (previous && !withinBlockLimit(state, selected.id, previous)) {
                      setRefused(true);
                      return;
                    }
                    setRefused(false);
                    onCopy(selected.id);
                  }}
                >
                  {t.copyPrevious}
                </button>
              </div>
            </div>
            {canWrite && blockLimitOf(state.biz) !== null ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{t.exceptionGrant}</p>
                  <p className="text-sm leading-6 text-muted">{t.exceptionGrantHint}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasConstraintGrant(state, selected.id)}
                  aria-label={t.exceptionGrant}
                  data-testid={`exception-grant-${selected.name}`}
                  className={`relative h-8 w-12 shrink-0 rounded-full ${hasConstraintGrant(state, selected.id) ? "bg-brand" : "bg-well"}`}
                  onClick={() => onGrant(selected.id, !hasConstraintGrant(state, selected.id))}
                >
                  <span
                    className={`absolute top-1 start-1 h-6 w-6 rounded-full bg-card shadow-sm motion-safe:transition-transform motion-safe:duration-200 ${
                      hasConstraintGrant(state, selected.id) ? "translate-x-4 rtl:-translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>
            ) : null}
            {blockLimitOf(state.biz) !== null ? (
              <p data-testid="block-limit-note" role={refused ? "alert" : undefined} className={`mt-2 text-sm ${refused ? "font-medium text-danger-text" : "text-muted"}`}>
                {t.blockLimitStatus(countBlocks(state, selected.id, state.avail[state.week]?.[selected.id]), blockLimitOf(state.biz) ?? 0)}
                {refused ? ` ${t.blockLimitReached}` : ""}
              </p>
            ) : null}
            <WeekGrid
              state={state}
              lang={lang}
              employeeId={selected.id}
              mode="availability"
              editable={canWrite}
              onToggle={(day, shiftId, checked) => {
                const next = gridWithCell(state, selected.id, state.avail[state.week]?.[selected.id], day, shiftId, checked);
                if (!withinBlockLimit(state, selected.id, next)) {
                  setRefused(true);
                  return;
                }
                setRefused(false);
                onAvailability(selected.id, day, shiftId, checked);
              }}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

/** Opens the extra submission window from the week toolbar. The duration lives in a menu, not on the page. */
export function ExtraWindowMenu({
  lang,
  until,
  onOpen,
  onClose,
}: {
  lang: Lang;
  until?: string;
  onOpen: (minutes: number) => void;
  onClose: () => void;
}) {
  const t = copy[lang];
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const countdown = useCountdown(until);
  const running = extensionStillOpen(until);
  const totalMinutes = hours * 60 + minutes;

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

  return (
    <>
      <div ref={root} className="relative">
        <button
          type="button"
          data-testid="extra-window-toggle"
          className={button.small}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((current) => !current)}
        >
          {t.extraWindow}
        </button>
        {open ? (
          <div
            role="dialog"
            aria-label={t.extraWindow}
            data-testid="extra-window"
            className="pop-in material-pop absolute start-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line p-4 shadow-pop"
          >
            <p className="text-sm leading-6 text-muted">{t.extraWindowHint}</p>
            <DurationWheels
              hours={hours}
              minutes={minutes}
              hoursLabel={t.extraWindowHours}
              minutesLabel={t.extraWindowMinutes}
              onHours={setHours}
              onMinutes={setMinutes}
            />
            <button
              type="button"
              data-testid="open-extra-window"
              className={`${button.primary} mt-3`}
              disabled={totalMinutes < 1}
              onClick={() => {
                onOpen(totalMinutes);
                setOpen(false);
              }}
            >
              {t.extraWindowOpen}
            </button>
          </div>
        ) : null}
      </div>
      {countdown ? (
        <p data-testid="extra-window-remaining" className="text-sm font-medium tabular-nums text-ink">
          {countdown}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="close-extra-window"
        className={`${button.small} disabled:hover:border-line disabled:hover:bg-card`}
        disabled={!running}
        onClick={onClose}
      >
        {t.extraWindowClose}
      </button>
    </>
  );
}

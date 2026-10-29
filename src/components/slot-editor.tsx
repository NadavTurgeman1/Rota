import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { clockNear, coverageGaps, type Lang, type RotaState, type Slot } from "../domain";
import { callOffLabel, coverageGapText, copy } from "../i18n/copy";
import { employeeName } from "../people/edit";
import { hourFixLine, slotTitle } from "../schedule/display";
import { assignmentToken, clockLabel, hourFixBucket, hourFixes, slotLocked } from "../schedule/edit";
import { SolutionGroups } from "./solution-groups";
import { button, card, cardTitle, field } from "./ui";

/** Edits one cell. A draft changes headcount and each person's hours. A published week only records a call-off. */
export function SlotEditor({
  state,
  slot,
  lang,
  published,
  nowHours,
  onClose,
  onRequired,
  onHours,
  onCallOff,
  onToggleLock,
}: {
  state: RotaState;
  slot: Slot;
  lang: Lang;
  published: boolean;
  nowHours: number | null;
  onClose: () => void;
  onRequired: (shiftId: string, day: number, count: number) => void;
  onHours: (slotKey: string, employeeId: string, start: number, end: number) => void;
  onCallOff: (slotKey: string, employeeId: string) => void;
  onToggleLock: () => void;
}) {
  const t = copy[lang];
  const dialog = useRef<HTMLDivElement>(null);
  const schedule = state.sched[state.week];
  const ids = schedule?.assign[slot.key] ?? [];
  const shift = state.biz.shifts.find((item) => item.id === slot.shiftId);
  const title = slotTitle(state, slot, lang);
  const gaps = published ? [] : coverageGaps(state, slot);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-editor-title"
        tabIndex={-1}
        data-testid="slot-editor"
        data-mode={published ? "calloff" : "draft"}
        className={`${card} pop-in pop-in-center flex max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-y-auto outline-none`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="slot-editor-title" className={cardTitle}>
          {title}
        </h2>
        <p dir="ltr" className="mt-1 text-sm tabular-nums text-muted">
          {shift?.start}–{shift?.end}
        </p>

        {published ? (
          <p className="mt-4 text-sm leading-6 text-ink">{t.callOffHint}</p>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between gap-3 border-b border-line pb-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{t.slotLock}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{ids.length > 0 ? t.slotLockHint : t.slotLockEmpty}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={slotLocked(state, slot.key)}
                aria-label={t.slotLock}
                data-testid="slot-lock"
                disabled={ids.length === 0}
                className={`relative mt-0.5 h-8 w-12 shrink-0 rounded-full disabled:opacity-50 ${slotLocked(state, slot.key) ? "bg-brand" : "bg-well"}`}
                onClick={onToggleLock}
              >
                <span
                  className={`absolute top-1 start-1 h-6 w-6 rounded-full bg-card shadow-sm motion-safe:transition-transform motion-safe:duration-200 ${
                    slotLocked(state, slot.key) ? "translate-x-4 rtl:-translate-x-4" : ""
                  }`}
                />
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">{t.requiredOnShift}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="slot-required-less"
                  aria-label={t.fewerRequired}
                  className={button.icon}
                  disabled={slot.required <= 1}
                  onClick={() => onRequired(slot.shiftId, slot.day, slot.required - 1)}
                >
                  −
                </button>
                <span data-testid="slot-required" className="w-8 text-center text-sm font-semibold tabular-nums text-ink">
                  {slot.required}
                </span>
                <button
                  type="button"
                  data-testid="slot-required-more"
                  aria-label={t.moreRequired}
                  className={button.icon}
                  onClick={() => onRequired(slot.shiftId, slot.day, slot.required + 1)}
                >
                  +
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{t.shiftHoursHint}</p>
          </>
        )}

        <ul className="mt-4 flex flex-col">
          {ids.map((employeeId) => {
            const name = employeeName(state, employeeId);
            const token = assignmentToken(slot.key, employeeId);
            const extension = schedule?.ext?.[token];
            const custom = schedule?.hours?.[token];
            const span = extension ?? custom ?? { start: slot.start, end: slot.end };
            const openShift = nowHours !== null && span.end > nowHours;
            const shiftName = shift?.name ?? "shift";
            function commit(kind: "start" | "end", value: string) {
              const clock = value.slice(0, 5);
              if (!/^\d{2}:\d{2}$/.test(clock)) return;
              const nextStart = kind === "start" ? clockNear(span.start, clock) : span.start;
              const nextEnd = kind === "end" ? clockNear(span.end, clock) : span.end;
              onHours(slot.key, employeeId, nextStart, nextEnd);
            }
            return (
              <li key={employeeId} className="flex flex-col gap-2 border-t border-line py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{name}</p>
                    {published && (extension || custom) ? (
                      <p dir="ltr" className="text-xs tabular-nums text-danger-text">
                        {clockLabel(span.start)}–{clockLabel(span.end)}
                      </p>
                    ) : null}
                  </div>
                  {published && openShift ? (
                    <button
                      type="button"
                      data-testid={`calloff-${slot.day}-${shiftName}-${name}`}
                      aria-label={callOffLabel(lang, name)}
                      className={`${button.danger} shrink-0`}
                      onClick={() => onCallOff(slot.key, employeeId)}
                    >
                      {t.callOff}
                    </button>
                  ) : null}
                </div>
                {published ? null : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs font-medium text-ink-soft">{t.shiftStart}</span>
                      <input
                        type="time"
                        dir="ltr"
                        step={60}
                        data-testid={`hours-start-${slot.day}-${shiftName}-${name}`}
                        aria-label={t.startHourLabel(name)}
                        className={`${field} tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
                        value={clockLabel(span.start)}
                        onChange={(event) => commit("start", event.target.value)}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="text-xs font-medium text-ink-soft">{t.shiftEnd}</span>
                      <input
                        type="time"
                        dir="ltr"
                        step={60}
                        data-testid={`hours-end-${slot.day}-${shiftName}-${name}`}
                        aria-label={t.endHourLabel(name)}
                        className={`${field} tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`}
                        value={clockLabel(span.end)}
                        onChange={(event) => commit("end", event.target.value)}
                      />
                    </label>
                  </div>
                )}
                {!published && (custom || extension) ? (
                  <button
                    type="button"
                    data-testid={`hours-reset-${slot.day}-${shiftName}-${name}`}
                    className={`${button.small} self-start`}
                    onClick={() => onHours(slot.key, employeeId, slot.start, slot.end)}
                  >
                    {t.resetShiftHours}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {gaps.map((gap) => {
          const fixes = hourFixes(state, gap);
          return (
            <div key={`${gap.start}-${gap.end}-${gap.delta}`} data-testid="slot-coverage" className="mt-3">
              <p className="text-sm font-medium leading-6 text-danger-text">
                {coverageGapText(lang, gap.delta)}{" "}
                <span dir="ltr" className="tabular-nums">
                  {clockLabel(gap.start)}–{clockLabel(gap.end)}
                </span>
              </p>
              <SolutionGroups
                testId={`solutions-slot-${slot.day}-${slot.shiftId}-${gap.start}`}
                groups={[
                  {
                    id: "extend",
                    title: t.solutionExtend,
                    items:
                      hourFixBucket(gap.delta) === "extend"
                        ? fixes.map((fix) => (
                            <button
                              key={`${fix.slotKey}-${fix.employeeId}-${fix.edge}`}
                              type="button"
                              data-testid={`slot-hour-fix-${fix.employeeId}-${fix.edge}`}
                              className={button.action}
                              onClick={() => onHours(fix.slotKey, fix.employeeId, fix.start, fix.end)}
                            >
                              {hourFixLine(fix, lang, state)}
                            </button>
                          ))
                        : [],
                  },
                  {
                    id: "change",
                    title: t.solutionChange,
                    items:
                      hourFixBucket(gap.delta) === "change"
                        ? fixes.map((fix) => (
                            <button
                              key={`${fix.slotKey}-${fix.employeeId}-${fix.edge}`}
                              type="button"
                              data-testid={`slot-hour-fix-${fix.employeeId}-${fix.edge}`}
                              className={button.action}
                              onClick={() => onHours(fix.slotKey, fix.employeeId, fix.start, fix.end)}
                            >
                              {hourFixLine(fix, lang, state)}
                            </button>
                          ))
                        : [],
                  },
                ]}
              />
            </div>
          );
        })}

        {published
          ? (schedule?.calloffs ?? [])
              .filter((item) => item.slotKey === slot.key)
              .map((item) => (
                <p key={item.id} className="mt-2 truncate text-sm font-medium text-danger-text">
                  {item.name} · {t.calledOff}
                </p>
              ))
          : null}

        <button type="button" className={`${button.quiet} mt-4 w-full`} onClick={onClose}>
          {t.closePanel}
        </button>
      </div>
    </div>,
    document.body,
  );
}

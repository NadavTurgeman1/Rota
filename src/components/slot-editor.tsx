import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { dayName, type Lang, type RotaState, type Slot } from "../domain";
import { callOffLabel, copy } from "../i18n/copy";
import { employeeName } from "../people/edit";
import { shiftLabel } from "../schedule/display";
import { assignmentToken, clockLabel, doubleShiftPlan } from "../schedule/edit";
import { button, card, cardTitle } from "./ui";

/** Edits one cell. A draft changes headcount and doubles. A published week only records a call-off. */
export function SlotEditor({
  state,
  slot,
  lang,
  published,
  nowHours,
  onClose,
  onRequired,
  onExtend,
  onCallOff,
}: {
  state: RotaState;
  slot: Slot;
  lang: Lang;
  published: boolean;
  nowHours: number | null;
  onClose: () => void;
  onRequired: (shiftId: string, day: number, count: number) => void;
  onExtend: (slotKey: string, employeeId: string) => void;
  onCallOff: (slotKey: string, employeeId: string) => void;
}) {
  const t = copy[lang];
  const dialog = useRef<HTMLDivElement>(null);
  const schedule = state.sched[state.week];
  const ids = schedule?.assign[slot.key] ?? [];
  const shift = state.biz.shifts.find((item) => item.id === slot.shiftId);
  const title = `${dayName(slot.day, lang)} · ${shiftLabel(shift?.name ?? "", lang)}`;

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
        className={`${card} pop-in pop-in-center w-full max-w-md outline-none`}
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
        )}

        <ul className="mt-4 flex flex-col">
          {ids.map((employeeId) => {
            const name = employeeName(state, employeeId);
            const token = assignmentToken(slot.key, employeeId);
            const extension = schedule?.ext?.[token];
            const canDouble = Boolean(extension) || doubleShiftPlan(state, slot.key, employeeId) !== null;
            const openShift = nowHours !== null && (extension?.end ?? slot.end) > nowHours;
            return (
              <li key={employeeId} className="flex items-center gap-3 border-t border-line py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{name}</p>
                  {extension ? (
                    <p dir="ltr" className="text-xs tabular-nums text-danger-text">
                      {clockLabel(extension.start)}–{clockLabel(extension.end)}
                    </p>
                  ) : null}
                </div>
                {published ? (
                  openShift ? (
                    <button
                      type="button"
                      data-testid={`calloff-${slot.day}-${shift?.name ?? "shift"}-${name}`}
                      aria-label={callOffLabel(lang, name)}
                      className={`${button.danger} shrink-0`}
                      onClick={() => onCallOff(slot.key, employeeId)}
                    >
                      {t.callOff}
                    </button>
                  ) : null
                ) : extension ? (
                  <button
                    type="button"
                    data-testid={`double-${slot.day}-${shift?.name ?? "shift"}-${name}`}
                    aria-pressed="true"
                    aria-label={t.clearDoubleLabel(name)}
                    className={`${button.small} shrink-0`}
                    onClick={() => onExtend(slot.key, employeeId)}
                  >
                    {t.shortenShift}
                  </button>
                ) : canDouble ? (
                  <button
                    type="button"
                    data-testid={`double-${slot.day}-${shift?.name ?? "shift"}-${name}`}
                    aria-pressed="false"
                    aria-label={t.extendDoubleLabel(name)}
                    className={`${button.small} shrink-0`}
                    onClick={() => onExtend(slot.key, employeeId)}
                  >
                    {t.extendDouble}
                  </button>
                ) : (
                  <p className="max-w-40 text-end text-xs leading-5 text-muted">{t.noDoubleRoom}</p>
                )}
              </li>
            );
          })}
        </ul>

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

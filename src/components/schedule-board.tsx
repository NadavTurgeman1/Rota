import { Fragment, useEffect, useRef } from "react";
import { dayName, shiftKind, type Lang, type RotaState, type Slot } from "../domain";
import { copy } from "../i18n/copy";
import { columnIsToday, shiftLabel } from "../schedule/display";
import { DayDates } from "./day-dates";
import { SlotCard } from "./slot-card";

const DOT: Record<ReturnType<typeof shiftKind>, string> = {
  m: "bg-shift-m",
  a: "bg-shift-a",
  n: "bg-shift-n",
};

/** The card fill reaches over the cell spacing around it, so nothing scrolled sideways shows through. */
const STICKY = "sticky start-0 z-10 bg-card before:absolute before:-inset-1 before:-z-10 before:bg-card before:content-['']";

function slotActions(props: {
  state: RotaState;
  lang: Lang;
  published: boolean;
  canCallOff: boolean;
  nowHours: number | null;
  selectedToken: string | null;
  focusEmployeeId: string | null;
  onAdd: (slotKey: string, employeeId: string) => void;
  onRemove: (slotKey: string, employeeId: string) => void;
  onMove: (fromKey: string, employeeId: string, toKey: string) => void;
  onSwap: (slotKey: string, employeeId: string, otherId: string) => void;
  onToggleSelect: (token: string) => void;
  onCallOff: (slotKey: string, employeeId: string) => void;
  onUndoCallOff: (callOffId: string) => void;
  onHours: (slotKey: string, employeeId: string, start: number, end: number) => void;
  onRequired: (shiftId: string, day: number, count: number) => void;
  onToggleLock: (slotKey: string) => void;
}) {
  return props;
}

export function WeekBoard({
  state,
  slots,
  lang,
  published,
  canCallOff,
  nowHours,
  selectedToken,
  focusEmployeeId = null,
  fit = false,
  onAdd,
  onRemove,
  onMove,
  onSwap,
  onToggleSelect,
  onCallOff,
  onUndoCallOff,
  onHours,
  onRequired,
  onToggleLock,
}: {
  state: RotaState;
  slots: Slot[];
  lang: Lang;
  published: boolean;
  canCallOff: boolean;
  nowHours: number | null;
  selectedToken: string | null;
  focusEmployeeId?: string | null;
  /** Fill the space under the toolbar so every shift and day is on screen. */
  fit?: boolean;
  onAdd: (slotKey: string, employeeId: string) => void;
  onRemove: (slotKey: string, employeeId: string) => void;
  onMove: (fromKey: string, employeeId: string, toKey: string) => void;
  onSwap: (slotKey: string, employeeId: string, otherId: string) => void;
  onToggleSelect: (token: string) => void;
  onCallOff: (slotKey: string, employeeId: string) => void;
  onUndoCallOff: (callOffId: string) => void;
  onHours: (slotKey: string, employeeId: string, start: number, end: number) => void;
  onRequired: (shiftId: string, day: number, count: number) => void;
  onToggleLock: (slotKey: string) => void;
}) {
  const t = copy[lang];
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = scroller.current;
    const today = root?.querySelector<HTMLElement>("[data-today]");
    if (!root || !today || root.scrollWidth <= root.clientWidth) return;
    today.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [state.week]);
  const shared = slotActions({
    state,
    lang,
    published,
    canCallOff,
    nowHours,
    selectedToken,
    focusEmployeeId,
    onAdd,
    onRemove,
    onMove,
    onSwap,
    onToggleSelect,
    onCallOff,
    onUndoCallOff,
    onHours,
    onRequired,
    onToggleLock,
  });
  const days = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div data-testid="week-board" className="min-w-0 rounded-xl border border-line bg-card p-1.5 sm:p-2">
      <p data-testid="scroll-hint" className="mb-2 px-1 text-xs text-subtle lg:hidden">
        {t.scrollHint}
      </p>
      <div ref={scroller} data-testid="week-scroll" className={fit ? "overflow-x-auto lg:overflow-x-hidden" : "overflow-x-auto"}>
        <div
          role="grid"
          className="week-fit"
          data-fit={fit ? "true" : "false"}
        >
          <div role="columnheader" className={STICKY} />
          {days.map((day) => {
            const today = columnIsToday(state.week, day);
            return (
              <div
                key={day}
                role="columnheader"
                data-today={today ? "true" : undefined}
                className={`min-w-0 px-0.5 pb-1 pt-0.5 text-center text-[11px] font-medium ${today ? "text-brand-text" : "text-muted"}`}
              >
                <span className="block truncate">{dayName(day, lang)}</span>
                <DayDates week={state.week} day={day} lang={lang} today={today} />
                <span aria-hidden="true" className={`mx-auto mt-1 block h-px w-8 ${today ? "bg-brand" : "bg-line"}`} />
              </div>
            );
          })}
          {state.biz.shifts.map((shift) => (
            <Fragment key={shift.id}>
              <div role="rowheader" className={`${STICKY} px-1 py-0.5 text-start`}>
                <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold leading-4 text-ink">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[shiftKind(shift.start, shift.end)]}`} aria-hidden="true" />
                  <span className="truncate">{shiftLabel(shift.name, lang)}</span>
                </span>
                <span dir="ltr" className="block truncate text-[10px] font-normal tabular-nums leading-4 text-muted">
                  {shift.start}–{shift.end}
                </span>
              </div>
              {days.map((day) => {
                const slot = slots.find((item) => item.day === day && item.shiftId === shift.id);
                return (
                  <div key={day} role="gridcell" className="min-w-0">
                    {slot ? (
                      <SlotCard slot={slot} {...shared} />
                    ) : (
                      <div className="flex items-center justify-center rounded-lg border border-dashed border-line text-[11px] font-medium text-subtle">
                        {t.closed}
                      </div>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

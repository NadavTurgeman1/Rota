import { useEffect, useRef } from "react";
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
  onAdd,
  onRemove,
  onMove,
  onSwap,
  onToggleSelect,
  onCallOff,
}: {
  state: RotaState;
  slots: Slot[];
  lang: Lang;
  published: boolean;
  canCallOff: boolean;
  nowHours: number | null;
  selectedToken: string | null;
  focusEmployeeId?: string | null;
  onAdd: (slotKey: string, employeeId: string) => void;
  onRemove: (slotKey: string, employeeId: string) => void;
  onMove: (fromKey: string, employeeId: string, toKey: string) => void;
  onSwap: (slotKey: string, employeeId: string, otherId: string) => void;
  onToggleSelect: (token: string) => void;
  onCallOff: (slotKey: string, employeeId: string) => void;
}) {
  const t = copy[lang];
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>("[data-today]")?.scrollIntoView?.({ inline: "center", block: "nearest" });
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
  });
  return (
    <div data-testid="week-board" className="min-w-0 rounded-xl border border-line bg-card p-1.5 sm:p-2">
      <p data-testid="scroll-hint" className="mb-2 px-1 text-xs text-subtle lg:hidden">
        {t.scrollHint}
      </p>
      <div ref={scroller} data-testid="week-scroll" className="overflow-x-auto">
      <table className="w-full min-w-[840px] table-fixed border-separate border-spacing-1">
        <thead>
          <tr>
            <th className={`${STICKY} w-24`} />
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const today = columnIsToday(state.week, day);
              return (
              <th key={day} data-today={today ? "true" : undefined} className={`px-1 pb-1.5 pt-0.5 align-top text-[11px] font-medium ${today ? "text-brand-text" : "text-muted"}`}>
                <span className="block">{dayName(day, lang)}</span>
                <DayDates week={state.week} day={day} lang={lang} today={today} />
                <span aria-hidden="true" className={`mx-auto mt-1.5 block h-px w-8 ${today ? "bg-brand" : "bg-line"}`} />
              </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {state.biz.shifts.map((shift) => (
            <tr key={shift.id}>
              <th className={`${STICKY} px-1.5 py-1 text-start align-middle`}>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[shiftKind(shift.start, shift.end)]}`} aria-hidden="true" />
                  <span className="truncate">{shiftLabel(shift.name, lang)}</span>
                </span>
                <span dir="ltr" className="mt-0.5 block text-[11px] font-normal tabular-nums text-muted">
                  {shift.start}–{shift.end}
                </span>
              </th>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const slot = slots.find((item) => item.day === day && item.shiftId === shift.id);
                return (
                  <td key={day} className="h-px align-top">
                    {slot ? (
                      <SlotCard slot={slot} {...shared} />
                    ) : (
                      <div className="flex h-full min-h-[4.75rem] items-center justify-center rounded-lg border border-dashed border-line text-[11px] font-medium text-subtle">
                        {t.closed}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

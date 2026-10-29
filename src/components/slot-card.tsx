import { useRef, useState, type DragEvent } from "react";
import { coveredSeats, coverageGaps, fullShiftCoveredByHours, shiftKind, slotPresence, type Lang, type RotaState, type Slot } from "../domain";
import { copy, removeLabel } from "../i18n/copy";
import { employeeName } from "../people/edit";
import { assignmentToken, clockLabel, parseAssignmentToken } from "../schedule/edit";
import { AddEmployeeMenu } from "./add-employee-menu";
import { SlotEditor } from "./slot-editor";

const FILL: Record<ReturnType<typeof shiftKind>, string> = {
  m: "bg-slot-m",
  a: "bg-slot-a",
  n: "bg-slot-n",
};

export function SlotCard({
  state,
  slot,
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
  onHours,
  onRequired,
}: {
  state: RotaState;
  slot: Slot;
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
  onHours: (slotKey: string, employeeId: string, start: number, end: number) => void;
  onRequired: (shiftId: string, day: number, count: number) => void;
}) {
  const dragged = useRef(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const t = copy[lang];
  const schedule = state.sched[state.week];
  const ids = schedule?.assign[slot.key] ?? [];
  const covered = schedule ? coveredSeats(schedule, slot.key) : 0;
  const presence = slotPresence(state, slot);
  const headcount = ids.length + covered;
  const filled = presence ?? headcount;
  const shift = state.biz.shifts.find((item) => item.id === slot.shiftId);
  const kind = shiftKind(shift?.start ?? "06:00", shift?.end ?? "14:00");
  const gaps = coverageGaps(state, slot);
  const hourCovered = fullShiftCoveredByHours(state, slot);
  const short = gaps.some((gap) => gap.delta < 0) || (presence === null ? headcount < slot.required : presence < slot.required);
  const over = !short && (gaps.some((gap) => gap.delta > 0) || (presence === null && ids.length > slot.required));
  const testId = `slot-${slot.day}-${shift?.name ?? slot.shiftId}`;
  const canEdit = !published || canCallOff;

  function acceptDrop(event: DragEvent<HTMLDivElement>) {
    if (published) return;
    event.preventDefault();
    const parsed = parseAssignmentToken(event.dataTransfer.getData("text/plain"));
    if (!parsed) return;
    onMove(parsed.slotKey, parsed.employeeId, slot.key);
  }

  return (
    <div
      data-testid={testId}
      onDragOver={(event) => {
        if (!published) event.preventDefault();
      }}
      onDrop={acceptDrop}
      onClick={() => {
        if (selectedToken && !published) {
          const parsed = parseAssignmentToken(selectedToken);
          if (!parsed) return;
          if (parsed.slotKey === slot.key) onToggleSelect(selectedToken);
          else onMove(parsed.slotKey, parsed.employeeId, slot.key);
          return;
        }
        if (canEdit) setEditing(true);
      }}
      className={`flex h-full min-h-[4.75rem] flex-col gap-1 rounded-lg border border-line p-1.5 ${FILL[kind]} ${
        selectedToken && !published ? "cursor-pointer hover:ring-2 hover:ring-focus/60" : canEdit ? "cursor-pointer hover:ring-2 hover:ring-focus/40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        {canEdit ? (
          <button
            type="button"
            data-testid={`${testId}-count`}
            aria-label={t.editShiftLabel(filled, slot.required)}
            className={`rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums ${
              short ? "bg-danger-soft text-danger-text" : over ? "bg-warn-soft text-warn-text" : "bg-ok-soft text-ok-text"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
            }}
          >
            {filled}/{slot.required}
          </button>
        ) : (
          <span
            data-testid={`${testId}-count`}
            className={`rounded-full px-1.5 text-[11px] font-semibold leading-5 tabular-nums ${
              short ? "bg-danger-soft text-danger-text" : over ? "bg-warn-soft text-warn-text" : "bg-ok-soft text-ok-text"
            }`}
          >
            {filled}/{slot.required}
          </span>
        )}
        {published ? null : (
          <AddEmployeeMenu
            state={state}
            slot={slot}
            lang={lang}
            testId={`add-${slot.day}-${shift?.name ?? "shift"}`}
            onAdd={onAdd}
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {ids.map((employeeId) => {
          const token = assignmentToken(slot.key, employeeId);
          const extension = schedule?.ext?.[token];
          const custom = schedule?.hours?.[token];
          const span = extension ?? custom;
          const name = employeeName(state, employeeId);
          return (
            <div
              key={employeeId}
              data-testid={`chip-${slot.day}-${shift?.name ?? "shift"}-${name}`}
              draggable={!published}
              onDragStart={(event) => {
                dragged.current = true;
                event.dataTransfer.setData("text/plain", token);
                event.dataTransfer.effectAllowed = "move";
                const box = event.currentTarget.getBoundingClientRect();
                event.dataTransfer.setDragImage(event.currentTarget, event.clientX - box.left, event.clientY - box.top);
                setDragging(employeeId);
              }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => {
                if (published) return;
                event.preventDefault();
                setDropTarget(employeeId);
              }}
              onDragLeave={() => setDropTarget((current) => (current === employeeId ? null : current))}
              onDrop={(event) => {
                setDropTarget(null);
                const parsed = parseAssignmentToken(event.dataTransfer.getData("text/plain"));
                if (published || !parsed || parsed.slotKey !== slot.key) return;
                event.preventDefault();
                event.stopPropagation();
                onSwap(slot.key, parsed.employeeId, employeeId);
              }}
              onClick={(event) => event.stopPropagation()}
              className={`flex items-center gap-0.5 rounded-md border border-line bg-chip py-0.5 ps-1.5 pe-0.5 text-xs font-medium shadow-card hover:border-field-line ${
                selectedToken === token || dropTarget === employeeId || focusEmployeeId === employeeId ? "ring-2 ring-focus" : ""
              } ${dragging === employeeId ? "opacity-50" : ""} ${
                focusEmployeeId && focusEmployeeId !== employeeId ? "opacity-40" : ""
              } ${published ? "" : "cursor-grab active:cursor-grabbing"}`}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col items-start text-start"
                onClick={(event) => {
                  event.stopPropagation();
                  if (dragged.current) {
                    dragged.current = false;
                    return;
                  }
                  if (published) return;
                  const picked = selectedToken ? parseAssignmentToken(selectedToken) : null;
                  if (picked && picked.slotKey === slot.key && picked.employeeId !== employeeId) {
                    onSwap(slot.key, picked.employeeId, employeeId);
                    onToggleSelect(selectedToken!);
                    return;
                  }
                  if (picked && picked.slotKey !== slot.key) {
                    onMove(picked.slotKey, picked.employeeId, slot.key);
                    return;
                  }
                  onToggleSelect(token);
                }}
              >
                <span className="max-w-full truncate leading-5" title={name}>
                  {name}
                </span>
                {span ? (
                  <span dir="ltr" className="text-[11px] font-normal tabular-nums text-danger-text">
                    {clockLabel(span.start)}–{clockLabel(span.end)}
                  </span>
                ) : null}
                {schedule?.over?.[token] ? (
                  <span className="text-[11px] font-semibold text-warn-text">{t.overQuota}</span>
                ) : null}
              </button>
              {published ? null : (
                <button
                  type="button"
                  aria-label={removeLabel(lang, name)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded text-sm leading-none text-subtle hover:bg-danger-softer hover:text-danger-text"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(slot.key, employeeId);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
        {covered > 0 || hourCovered ? (
          <p data-testid={`${testId}-covered`} className="text-[11px] font-medium text-brand-text">
            {t.covered}
          </p>
        ) : null}
        {(schedule?.calloffs ?? [])
          .filter((item) => item.slotKey === slot.key && !ids.includes(item.employeeId))
          .map((item) => (
            <p
              key={item.id}
              data-testid={`calloff-note-${slot.day}-${shift?.name ?? "shift"}-${item.name}`}
              className="truncate rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger-text"
              title={item.at}
            >
              {item.name} · {t.calledOff}
            </p>
          ))}
      </div>
      {editing ? (
        <SlotEditor
          state={state}
          slot={slot}
          lang={lang}
          published={published}
          nowHours={nowHours}
          onClose={() => setEditing(false)}
          onRequired={onRequired}
          onHours={onHours}
          onCallOff={onCallOff}
        />
      ) : null}
    </div>
  );
}

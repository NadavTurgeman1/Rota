"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatReason, type Lang, type Reason, type RotaState, type Slot } from "../domain";
import { copy } from "../i18n/copy";
import { localizeShiftNames } from "../schedule/display";
import { canPlace, placementIssue } from "../schedule/edit";

type Candidate = { id: string; name: string; reason: Reason | null };

function candidatesFor(state: RotaState, slot: Slot, lang: Lang): { open: Candidate[]; closed: Candidate[] } {
  const assigned = new Set(state.sched[state.week]?.assign[slot.key] ?? []);
  const people = state.emps
    .filter((employee) => !assigned.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      name: employee.name,
      reason: placementIssue(state, slot, employee.id, lang),
    }));
  const byName = (left: Candidate, right: Candidate) => left.name.localeCompare(right.name, "he");
  const open = people
    .filter((person) => canPlace(person.reason))
    .sort((left, right) => Number(left.reason !== null) - Number(right.reason !== null) || byName(left, right));
  const closed = people.filter((person) => !canPlace(person.reason)).sort(byName);
  return { open, closed };
}

/** The plus on a shift. Available people come first. Anyone who cannot take it follows, dimmed, with the reason. */
export function AddEmployeeMenu({
  state,
  slot,
  lang,
  testId,
  onAdd,
}: {
  state: RotaState;
  slot: Slot;
  lang: Lang;
  testId: string;
  onAdd: (slotKey: string, employeeId: string) => void;
}) {
  const t = copy[lang];
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const { open: available, closed } = candidatesFor(state, slot, lang);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(288, window.innerWidth - 16);
      const rtl = (button.current?.closest("[dir]")?.getAttribute("dir") ?? document.documentElement.dir) !== "ltr";
      let left = rtl ? rect.left : rect.right - width;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const downward = below >= 160 || below >= above;
      const maxHeight = Math.max(120, Math.min(320, downward ? below : above));
      const top = downward ? rect.bottom + 4 : Math.max(8, rect.top - 4 - maxHeight);
      setBox({ top, left, maxHeight });
    }
    place();
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      const target = event.target as Node;
      if (button.current?.contains(target) || menu.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function choose(employeeId: string) {
    setOpen(false);
    onAdd(slot.key, employeeId);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        data-testid={testId}
        aria-label={t.addEmployee}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t.addEmployee}
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-dashed border-field-line text-sm leading-none text-ink-soft hover:border-solid hover:bg-chip focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <span aria-hidden="true">+</span>
      </button>
      {open && box
        ? createPortal(
            <div
              ref={menu}
              role="listbox"
              aria-label={t.addEmployee}
              data-testid={`${testId}-menu`}
              style={{ top: box.top, left: box.left, maxHeight: box.maxHeight }}
              className="fixed z-40 w-[min(18rem,calc(100vw-1rem))] overflow-y-auto rounded-lg border border-line bg-card p-1 shadow-pop"
              onClick={(event) => event.stopPropagation()}
            >
              {available.length === 0 && closed.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted">{t.nobodyToAdd}</p> : null}
              {available.length > 0 ? (
                <div role="group" aria-label={t.availableForShift}>
                  <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted">{t.availableForShift}</p>
                  {available.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      data-testid={`${testId}-option-${person.id}`}
                      className="block w-full rounded-lg px-2 py-1.5 text-start hover:bg-well"
                      onClick={() => choose(person.id)}
                    >
                      <span className="block text-sm font-medium text-ink">{person.name}</span>
                      {person.reason ? (
                        <span className="mt-0.5 block text-xs leading-4 text-muted">{localizeShiftNames(formatReason(person.reason, lang), lang)}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
              {closed.length > 0 ? (
                <div role="group" aria-label={t.unavailableForShift}>
                  <p className="px-2 pb-1 pt-1.5 text-xs font-medium text-muted">{t.unavailableForShift}</p>
                  {closed.map((person) => (
                    <div key={person.id} role="option" aria-disabled="true" aria-selected={false} data-testid={`${testId}-closed-${person.id}`} className="px-2 py-1.5">
                      <span className="block text-sm text-muted">{person.name}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-ink-soft">
                        {person.reason ? localizeShiftNames(formatReason(person.reason, lang), lang) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

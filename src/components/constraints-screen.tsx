import type { Lang, RotaState } from "../domain";
import { copy } from "../i18n/copy";
import type { LineOverride } from "../parser";
import { availabilitySubmitted } from "../people/edit";
import { ConstraintPaste } from "./constraint-paste";
import { WeekGrid } from "./team-screen";

import { button, card, cardTitle, pill } from "./ui";

export function ConstraintsScreen({
  state,
  lang,
  canWrite,
  aiEnabled,
  onAvailability,
  onCopy,
  onApply,
}: {
  state: RotaState;
  lang: Lang;
  canWrite: boolean;
  aiEnabled: boolean;
  onAvailability: (employeeId: string, day: number, shiftId: string, available: boolean) => void;
  onCopy: (employeeId: string) => void;
  onApply: (raw: string, overrides: LineOverride[]) => void;
}) {
  const t = copy[lang];
  const people = [...state.emps.filter((employee) => employee.active), ...state.emps.filter((employee) => !employee.active)];
  const submitted = people.filter((employee) => availabilitySubmitted(state, employee.id)).length;

  return (
    <div data-testid="constraints-screen" className="flex flex-col gap-6">
      {canWrite ? <ConstraintPaste state={state} lang={lang} aiEnabled={aiEnabled} onApply={onApply} /> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        <span data-testid="submitted-count" className="font-semibold tabular-nums text-ink">
          {submitted}/{people.length} {t.submittedCount}
        </span>
        <span>{t.availabilityLocked}</span>
        <ul className="flex flex-wrap gap-2">
          <li className={`${pill} bg-brand-soft text-ink`}>{t.availableWeek}</li>
          <li className={`${pill} bg-danger-soft text-danger-text`}>{t.unavailableWeek}</li>
          <li className={`${pill} border border-line bg-well text-ink`}>{t.agreementForbids}</li>
          <li className={`${pill} bg-well-strong text-ink`}>{t.siteClosed}</li>
        </ul>
      </div>
      {people.length === 0 ? <p className={`${card} text-sm text-muted`}>{t.noEmployees}</p> : null}
      {people.map((employee) => {
        const done = availabilitySubmitted(state, employee.id);
        const editable = canWrite;
        return (
          <section key={employee.id} data-testid={`availability-card-${employee.name}`} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={cardTitle}>{employee.name}</h2>
              <span className={`${pill} ${done ? "bg-ok-soft text-ok-text" : "bg-well text-muted"}`}>
                {done ? t.submittedShort : t.notSubmittedShort}
              </span>
              {employee.active ? null : <span className="text-xs font-medium text-subtle">{t.inactive}</span>}
              <button
                type="button"
                data-testid={`copy-availability-${employee.name}`}
                className={`${button.quiet} ms-auto`}
                disabled={!editable}
                onClick={() => onCopy(employee.id)}
              >
                {t.copyPrevious}
              </button>
            </div>
            <WeekGrid
              state={state}
              lang={lang}
              employeeId={employee.id}
              mode="availability"
              editable={editable}
              onToggle={(day, shiftId, checked) => onAvailability(employee.id, day, shiftId, checked)}
            />
          </section>
        );
      })}
    </div>
  );
}

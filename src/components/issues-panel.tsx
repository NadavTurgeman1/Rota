import { useState } from "react";
import {
  formatReason,
  planCallOff,
  type Analysis,
  type EmergencyChoice,
  type Lang,
  type RejectedCandidate,
  type RotaState,
  type Slot,
} from "../domain";
import { copy } from "../i18n/copy";
import { localizeShiftNames, proposalText, replacementText, slotTitle, splitText } from "../schedule/display";
import { proposalsFor, reliefChoices } from "../schedule/edit";
import { jsonAuthHeaders } from "../supabase/browser";
import { button as buttons, cardTitle, surface } from "./ui";

export function IssuesPanel({
  state,
  report,
  lang,
  hasSchedule,
  manager,
  published,
  aiEnabled,
  onApprove,
  onReplace,
  onEmergency,
  embedded = false,
}: {
  state: RotaState;
  report: Analysis;
  lang: Lang;
  hasSchedule: boolean;
  manager: boolean;
  published: boolean;
  aiEnabled: boolean;
  onApprove: (slot: Slot, index: number) => void;
  onReplace: (slot: Slot, employeeId: string) => void;
  onEmergency: (slot: Slot, choice: EmergencyChoice) => void;
  /** Inside the schedule side box, so the frame and the title already exist. */
  embedded?: boolean;
}) {
  const t = copy[lang];
  const clear = hasSchedule && report.violations.length === 0 && report.unfilled.length === 0;
  const showPublishHint = manager && !published;

  return (
    <aside data-testid="issues" className={embedded ? "min-w-0" : `${surface} p-4 sm:p-5`}>
      {embedded ? null : <h2 className={cardTitle}>{t.issues}</h2>}
      {!hasSchedule ? <p className={`${embedded ? "" : "mt-3 "}text-sm text-muted`}>{t.noSchedule}</p> : null}
      {clear ? <p className={`${embedded ? "" : "mt-3 "}rounded-xl bg-ok-softer px-3 py-2 text-sm font-medium text-ok-text`}>{showPublishHint ? t.allClear : t.publishedClear}</p> : null}
      {report.violations.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-sm font-medium text-danger-text">{t.violations}</h3>
          <ul className="mt-2 space-y-2">
            {report.violations.map((item, index) => (
              <li key={item.key ?? index} className="rounded-xl border border-danger-line/40 bg-danger-soft/50 px-3 py-2 text-sm leading-6">
                {localizeShiftNames(item.message, lang)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {report.overQuota.length > 0 ? (
        <section className="mt-4" data-testid="over-quota">
          <h3 className="text-sm font-medium text-warn-text">{t.overQuota}</h3>
          <ul className="mt-2 space-y-2">
            {report.overQuota.map((item) => (
              <li key={item.employee.id} className="rounded-xl border border-danger-line/40 bg-danger-soft/50 px-3 py-2 text-sm leading-6">
                {item.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {report.unfilled.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-sm font-medium text-danger-text">{t.openShifts}</h3>
          <ul className="mt-2 space-y-3">
            {report.unfilled.map((item) => {
              const proposals = manager && !published ? proposalsFor(state, item.slot) : [];
              return (
                <li key={item.slot.key} className="rounded-xl border border-danger-line/40 bg-danger-soft/50 px-3 py-3 text-sm leading-6">
                  <p className="font-medium">{slotTitle(state, item.slot, lang)}</p>
                  <p className="mt-1 text-muted">{localizeShiftNames(item.why, lang)}</p>
                  <p className="mt-1 text-muted">{localizeShiftNames(item.tip, lang)}</p>
                  {proposals.length === 0 ? null : (
                    <div className="mt-2 flex flex-col gap-1">
                      {proposals.map((proposal, index) => (
                        <button
                          key={`${proposal.kind}-${index}`}
                          type="button"
                          data-testid={`approve-${item.slot.day}-${item.slot.shiftId}-${index}`}
                          className={buttons.action}
                          onClick={() => onApprove(item.slot, index)}
                        >
                          {t.approve}: {proposalText(proposal, lang, state)}
                        </button>
                      ))}
                    </div>
                  )}
                  {manager && !published
                    ? reliefChoices(state, item.slot)
                        .filter((choice) => choice.held)
                        .map((choice) => (
                          <p key={choice.employeeId} data-testid={`relief-held-${choice.employeeId}`} className="mt-2 text-muted">
                            {t.reliefHeld.replace("{name}", choice.name)}
                          </p>
                        ))
                    : null}
                  {manager && published ? (
                    <CallOffChoices
                      state={state}
                      slot={item.slot}
                      lang={lang}
                      aiEnabled={aiEnabled}
                      onReplace={onReplace}
                      onEmergency={onEmergency}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {report.under.length > 0 ? (
        <section className="mt-4">
          <h3 className="text-sm font-medium text-warn-text">{t.underQuota}</h3>
          <ul className="mt-2 space-y-2">
            {report.under.map((item) => (
              <li key={item.employee.id} className="rounded-xl border border-danger-line/40 bg-danger-soft/50 px-3 py-2 text-sm leading-6">
                <p>{item.message}</p>
                <p className="mt-1 text-muted">{item.why}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function RejectedLine({
  slotKey,
  candidate,
  seat,
  lang,
  aiEnabled,
}: {
  slotKey: string;
  candidate: RejectedCandidate;
  seat: string;
  lang: Lang;
  aiEnabled: boolean;
}) {
  const t = copy[lang];
  const [explanation, setExplanation] = useState<{ lang: Lang; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = explanation?.lang === lang ? explanation.text : null;

  async function explain() {
    setBusy(true);
    try {
      const response = await fetch("/api/ai/explain", {
        method: "POST",
        headers: await jsonAuthHeaders(),
        body: JSON.stringify({ lang, name: candidate.name, seat, reason: candidate.reason }),
      });
      const body = (await response.json()) as { text?: unknown };
      if (response.ok && typeof body.text === "string") setExplanation({ lang, text: body.text });
    } catch {
      setExplanation(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li>
      {candidate.name} — {localizeShiftNames(formatReason(candidate.reason, lang), lang)}
      {aiEnabled && !shown ? (
        <button
          type="button"
          data-testid={`explain-${slotKey}-${candidate.employeeId}`}
          className={`${buttons.small} ms-2 h-7 px-2`}
          disabled={busy}
          onClick={explain}
        >
          {t.explain}
        </button>
      ) : null}
      {shown ? (
        <p data-testid={`explanation-${slotKey}-${candidate.employeeId}`} className="mt-0.5 text-ink-soft">
          {localizeShiftNames(shown, lang)}
        </p>
      ) : null}
    </li>
  );
}

function CallOffChoices({
  state,
  slot,
  lang,
  aiEnabled,
  onReplace,
  onEmergency,
}: {
  state: RotaState;
  slot: Slot;
  lang: Lang;
  aiEnabled: boolean;
  onReplace: (slot: Slot, employeeId: string) => void;
  onEmergency: (slot: Slot, choice: EmergencyChoice) => void;
}) {
  const t = copy[lang];
  const plan = planCallOff(state, slot);
  const button = buttons.action;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {plan.replacements.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-brand-text">{t.replacements}</p>
          <div className="mt-1 flex flex-col gap-1">
            {plan.replacements.map((candidate) => (
              <button
                key={candidate.employeeId}
                type="button"
                data-testid={`replace-${slot.day}-${slot.shiftId}-${candidate.employeeId}`}
                className={button}
                onClick={() => onReplace(slot, candidate.employeeId)}
              >
                {t.assignReplacement}: {replacementText(candidate, lang)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-danger-text">{t.noReplacement}</p>
          {plan.extensions.length + plan.splits.length + plan.extras.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1">
              <p className="text-xs font-medium">{t.emergency}</p>
              {plan.extras.map((option, index) => (
                <button
                  key={`extra-${index}`}
                  type="button"
                  data-testid={`emergency-extra-${slot.day}-${slot.shiftId}-${index}`}
                  className={button}
                  onClick={() => onEmergency(slot, { kind: "extra", index })}
                >
                  {t.approve}: {proposalText({ kind: "extra", option }, lang, state)}
                </button>
              ))}
              {plan.extensions.map((option, index) => (
                <button
                  key={`extension-${index}`}
                  type="button"
                  data-testid={`emergency-extension-${slot.day}-${slot.shiftId}-${index}`}
                  className={button}
                  onClick={() => onEmergency(slot, { kind: "extension", index })}
                >
                  {t.approve}: {proposalText({ kind: "coverage", option }, lang, state)}
                </button>
              ))}
              {plan.splits.map((option, index) => (
                <button
                  key={`split-${index}`}
                  type="button"
                  data-testid={`emergency-split-${slot.day}-${slot.shiftId}-${index}`}
                  className={button}
                  onClick={() => onEmergency(slot, { kind: "split", index })}
                >
                  {t.approve}: {splitText(option, lang, state)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
      {plan.rejected.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted">{t.rejectedTitle}</p>
          <ul className="mt-1 space-y-0.5 text-xs text-muted">
            {plan.rejected.map((candidate) => (
              <RejectedLine
                key={candidate.employeeId}
                slotKey={slot.key}
                candidate={candidate}
                seat={slotTitle(state, slot, lang)}
                lang={lang}
                aiEnabled={aiEnabled}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

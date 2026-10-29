import { useState, type ReactNode } from "react";
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
import { coverageGapText, copy } from "../i18n/copy";
import { hourFixLine, localizeShiftNames, proposalText, replacementText, slotTitle, splitText } from "../schedule/display";
import { clockLabel, hourFixBucket, hourFixes, proposalBucket, proposalsFor, reliefChoices, type HourFix, type Proposal } from "../schedule/edit";
import { SolutionGroups } from "./solution-groups";

function hourFixButton(
  slot: Slot,
  fix: HourFix,
  lang: Lang,
  state: RotaState,
  onAdjustHours: (slotKey: string, employeeId: string, start: number, end: number) => void,
) {
  return (
    <button
      key={`${fix.slotKey}-${fix.employeeId}-${fix.edge}-${fix.start}-${fix.end}`}
      type="button"
      data-testid={`hour-fix-${slot.day}-${slot.shiftId}-${fix.employeeId}-${fix.edge}`}
      className={buttons.action}
      onClick={() => onAdjustHours(fix.slotKey, fix.employeeId, fix.start, fix.end)}
    >
      {hourFixLine(fix, lang, state)}
    </button>
  );
}

function proposalButton(slot: Slot, proposal: Proposal, index: number, lang: Lang, state: RotaState, onApprove: (slot: Slot, index: number) => void) {
  const t = copy[lang];
  return (
    <button
      key={`${proposal.kind}-${index}`}
      type="button"
      data-testid={`approve-${slot.day}-${slot.shiftId}-${index}`}
      className={buttons.action}
      onClick={() => onApprove(slot, index)}
    >
      {t.approve}: {proposalText(proposal, lang, state)}
    </button>
  );
}

function SolutionMenu({
  testId,
  lang,
  state,
  slot,
  add,
  extend,
  change,
  proposals,
  onApprove,
}: {
  testId: string;
  lang: Lang;
  state: RotaState;
  slot: Slot;
  add: ReactNode[];
  extend: ReactNode[];
  change: ReactNode[];
  proposals: Proposal[];
  onApprove: (slot: Slot, index: number) => void;
}) {
  const t = copy[lang];
  const groups: Record<"add" | "extend" | "change", ReactNode[]> = { add: [...add], extend: [...extend], change: [...change] };
  proposals.forEach((proposal, index) => {
    groups[proposalBucket(proposal)].push(proposalButton(slot, proposal, index, lang, state, onApprove));
  });
  return (
    <SolutionGroups
      testId={testId}
      groups={[
        { id: "add", title: t.solutionAdd, items: groups.add },
        { id: "extend", title: t.solutionExtend, items: groups.extend },
        { id: "change", title: t.solutionChange, items: groups.change },
      ]}
    />
  );
}
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
  onAdjustHours,
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
  onAdjustHours: (slotKey: string, employeeId: string, start: number, end: number) => void;
  onReplace: (slot: Slot, employeeId: string) => void;
  onEmergency: (slot: Slot, choice: EmergencyChoice) => void;
  /** Inside the schedule side box, so the frame and the title already exist. */
  embedded?: boolean;
}) {
  const t = copy[lang];
  const [laborOpen, setLaborOpen] = useState(false);
  const clear =
    hasSchedule &&
    report.violations.length === 0 &&
    report.unfilled.length === 0 &&
    report.coverage.length === 0 &&
    report.labor.length === 0;
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
      {report.labor.length > 0 ? (
        <section className="mt-4" data-testid="labor-notes">
          <button
            type="button"
            data-testid="labor-toggle"
            aria-expanded={laborOpen}
            className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-line bg-card px-3 py-1.5 text-start text-sm font-medium text-ink hover:bg-well"
            onClick={() => setLaborOpen((open) => !open)}
          >
            <span className="min-w-0">{t.laborTitle}</span>
            <span className="inline-flex shrink-0 items-center gap-2 text-xs font-medium text-muted">
              <span className="tabular-nums">{report.labor.length}</span>
              {laborOpen ? t.laborClose : t.laborOpen}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className={`h-3.5 w-3.5 transition-transform ${laborOpen ? "rotate-180" : ""}`}
                fill="currentColor"
              >
                <path d="M5.2 7.5a.75.75 0 0 1 1.06 0L10 11.2l3.74-3.7a.75.75 0 1 1 1.06 1.06l-4.27 4.24a.75.75 0 0 1-1.06 0L5.2 8.56a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </span>
          </button>
          {laborOpen ? (
            <ul className="mt-2 space-y-2">
              {report.labor.map((item) => (
                <li key={item.key} className="rounded-xl border border-warn-line/40 bg-warn-softer px-3 py-2 text-sm leading-6">
                  {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      {report.coverage.length > 0 ? (
        <section className="mt-4" data-testid="coverage-gaps">
          <h3 className="text-sm font-medium text-danger-text">{t.coverageTitle}</h3>
          <ul className="mt-2 space-y-2">
            {report.coverage.map((item) => {
              const fixes = manager && !published ? hourFixes(state, item) : [];
              const wholeSeat =
                fixes.length === 0 &&
                manager &&
                !published &&
                item.delta < 0 &&
                item.start <= item.slot.start + 0.05 &&
                item.end >= item.slot.end - 0.05;
              const proposals = wholeSeat ? proposalsFor(state, item.slot) : [];
              return (
                <li
                  key={`${item.slot.key}-${item.start}-${item.end}-${item.delta}`}
                  className="rounded-xl border border-danger-line/40 bg-danger-soft/50 px-3 py-2 text-sm leading-6"
                >
                  <span className="font-medium">{slotTitle(state, item.slot, lang)}</span>
                  {": "}
                  {coverageGapText(lang, item.delta)}{" "}
                  <span dir="ltr" className="tabular-nums">
                    {clockLabel(item.start)}–{clockLabel(item.end)}
                  </span>
                  <SolutionMenu
                    testId={`solutions-${item.slot.day}-${item.slot.shiftId}-${item.start}`}
                    lang={lang}
                    state={state}
                    slot={item.slot}
                    add={[]}
                    extend={hourFixBucket(item.delta) === "extend" ? fixes.map((fix) => hourFixButton(item.slot, fix, lang, state, onAdjustHours)) : []}
                    change={hourFixBucket(item.delta) === "change" ? fixes.map((fix) => hourFixButton(item.slot, fix, lang, state, onAdjustHours)) : []}
                    proposals={proposals}
                    onApprove={onApprove}
                  />
                </li>
              );
            })}
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
                  <SolutionMenu
                    testId={`solutions-${item.slot.day}-${item.slot.shiftId}`}
                    lang={lang}
                    add={[]}
                    extend={[]}
                    change={[]}
                    proposals={proposals}
                    state={state}
                    slot={item.slot}
                    onApprove={onApprove}
                  />
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
  const hasReplacement = plan.replacements.length > 0;
  const add = hasReplacement
    ? plan.replacements.map((candidate) => (
        <button
          key={candidate.employeeId}
          type="button"
          data-testid={`replace-${slot.day}-${slot.shiftId}-${candidate.employeeId}`}
          className={button}
          onClick={() => onReplace(slot, candidate.employeeId)}
        >
          {t.assignReplacement}: {replacementText(candidate, lang)}
        </button>
      ))
    : plan.extras.map((option, index) => (
        <button
          key={`extra-${index}`}
          type="button"
          data-testid={`emergency-extra-${slot.day}-${slot.shiftId}-${index}`}
          className={button}
          onClick={() => onEmergency(slot, { kind: "extra", index })}
        >
          {t.approve}: {proposalText({ kind: "extra", option }, lang, state)}
        </button>
      ));
  const extend = hasReplacement
    ? []
    : plan.extensions.map((option, index) => (
        <button
          key={`extension-${index}`}
          type="button"
          data-testid={`emergency-extension-${slot.day}-${slot.shiftId}-${index}`}
          className={button}
          onClick={() => onEmergency(slot, { kind: "extension", index })}
        >
          {t.approve}: {proposalText({ kind: "coverage", option }, lang, state)}
        </button>
      ));
  const change = hasReplacement
    ? []
    : plan.splits.map((option, index) => (
        <button
          key={`split-${index}`}
          type="button"
          data-testid={`emergency-split-${slot.day}-${slot.shiftId}-${index}`}
          className={button}
          onClick={() => onEmergency(slot, { kind: "split", index })}
        >
          {t.approve}: {splitText(option, lang, state)}
        </button>
      ));
  return (
    <div className="mt-2 flex flex-col gap-2">
      {hasReplacement ? null : <p className="text-xs text-danger-text">{t.noReplacement}</p>}
      <SolutionGroups
        testId={`solutions-calloff-${slot.day}-${slot.shiftId}`}
        groups={[
          { id: "add", title: t.solutionAdd, items: add },
          { id: "extend", title: t.solutionExtend, items: extend },
          { id: "change", title: t.solutionChange, items: change },
        ]}
      />
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

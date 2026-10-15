import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { constraintRequest, type ConstraintAnswer } from "../ai/constraints";
import { dayName, type Lang, type RotaState } from "../domain";
import { constraintReasonText, copy } from "../i18n/copy";
import { agreementCell } from "../people/edit";
import { checkOverride, constraintDraftWritable, parseConstraints, type LineOverride, type ParsedLine } from "../parser";
import { shiftLabel } from "../schedule/display";

import { button, card, cardHint, cardTitle, pill } from "./ui";

type ModelState = "idle" | "working" | "failed" | "nothing";

const STATUS_TONE = {
  recognized: "bg-brand-soft text-brand-text",
  ambiguous: "bg-warn-soft text-warn-text",
  unparsed: "bg-well text-muted",
} as const;

export function ConstraintPaste({
  state,
  lang,
  aiEnabled,
  onApply,
}: {
  state: RotaState;
  lang: Lang;
  aiEnabled: boolean;
  onApply: (raw: string, overrides: LineOverride[]) => void;
}) {
  const t = copy[lang];
  const [text, setText] = useState("");
  const textRef = useRef("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = "0px";
    area.style.height = `${area.scrollHeight}px`;
  }, [text, lang]);
  const [pending, setPending] = useState<LineOverride[]>([]);
  const [accepted, setAccepted] = useState<LineOverride[]>([]);
  const [model, setModel] = useState<ModelState>("idle");
  const rules = useMemo(() => parseConstraints(text, state), [state, text]);
  const draft = useMemo(() => parseConstraints(text, state, accepted), [state, text, accepted]);
  const writable = constraintDraftWritable(draft);
  const statusLabel = { recognized: t.lineRecognized, ambiguous: t.lineAmbiguous, unparsed: t.lineUnparsed };
  const request = constraintRequest(state, rules, lang);
  const settled = new Set([...pending, ...accepted].map((item) => item.line));
  const askable = request ? request.lines.filter((line) => !settled.has(line)) : [];

  function edit(next: string) {
    textRef.current = next;
    setText(next);
    setPending([]);
    setAccepted([]);
    setModel("idle");
  }

  async function ask() {
    if (!request || askable.length === 0) return;
    const asked = text;
    setModel("working");
    try {
      const response = await fetch("/api/ai/constraints", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...request, lines: askable }),
      });
      if (!response.ok) throw new Error(String(response.status));
      const answer = (await response.json()) as ConstraintAnswer;
      const checked = (answer.suggestions ?? []).flatMap((item) => {
        const override = checkOverride(item, state);
        return override && askable.includes(override.line) ? [override] : [];
      });
      if (textRef.current !== asked) return;
      setPending((existing) => [...existing.filter((item) => !checked.some((next) => next.line === item.line)), ...checked]);
      setModel(checked.length > 0 ? "idle" : "nothing");
    } catch {
      if (textRef.current === asked) setModel("failed");
    }
  }

  return (
    <section className={card}>
      <h2 className={cardTitle}>{t.pasteTitle}</h2>
      <p className={cardHint}>{t.pasteHint}</p>
      <div
        data-testid="constraint-scroll"
        className="mt-4 h-40 overflow-y-auto rounded-xl border border-field-line bg-card hover:border-muted focus-within:border-focus"
      >
        <textarea
          ref={areaRef}
          data-testid="constraint-text"
          value={text}
          dir={text ? "auto" : lang === "he" ? "rtl" : "ltr"}
          placeholder={t.pastePlaceholder}
          onChange={(event) => edit(event.target.value)}
          className={`block min-h-full w-full resize-none overflow-hidden border-0 bg-transparent px-4 py-3 text-sm leading-6 outline-none placeholder:text-subtle ${
            lang === "he" && !text ? "text-right" : "text-start"
          }`}
        />
      </div>
      {text.trim() ? (
        <div className="mt-4 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-ink-soft">{t.draftTitle}</h3>
          <ul className="flex flex-col gap-2">
            {draft.lines.map((line) => {
              const suggestion = pending.find((item) => item.line === line.line);
              return (
                <li key={line.line} data-testid={`constraint-line-${line.line}`} className="flex flex-col gap-1 text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={`${pill} ${STATUS_TONE[line.status]}`}>{statusLabel[line.status]}</span>
                    {line.source === "model" ? (
                      <span className={`${pill} bg-violet-soft text-violet-text`}>{t.modelSuggestion}</span>
                    ) : null}
                    <span className="whitespace-pre-wrap">{line.raw}</span>
                    <span className="text-muted">{lineSummary(line, state, lang)}</span>
                  </div>
                  {suggestion ? (
                    <div
                      data-testid={`suggestion-${line.line}`}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-soft bg-violet-softer px-3 py-2 text-xs text-violet-strong"
                    >
                      <span>
                        {t.modelSuggestion}: {overrideSummary(suggestion, state, lang)}
                      </span>
                      <button
                        type="button"
                        data-testid={`accept-suggestion-${line.line}`}
                        className={button.small}
                        onClick={() => {
                          setAccepted((current) => [...current.filter((item) => item.line !== suggestion.line), suggestion]);
                          setPending((current) => current.filter((item) => item.line !== suggestion.line));
                        }}
                      >
                        {t.acceptSuggestion}
                      </button>
                      <button
                        type="button"
                        data-testid={`reject-suggestion-${line.line}`}
                        className={button.small}
                        onClick={() => setPending((current) => current.filter((item) => item.line !== suggestion.line))}
                      >
                        {t.rejectSuggestion}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {askable.length > 0 ? (
            aiEnabled ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" data-testid="ask-model" className={button.quiet} disabled={model === "working"} onClick={ask}>
                  {model === "working" ? t.modelWorking : t.askModel}
                </button>
                {model === "failed" ? <span className="text-sm text-danger-text">{t.modelFailed}</span> : null}
                {model === "nothing" ? <span className="text-sm text-muted">{t.modelNothing}</span> : null}
              </div>
            ) : (
              <p data-testid="model-off" className="text-xs text-subtle">
                {t.modelOff}
              </p>
            )
          ) : null}
          {writable ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-ink-soft">{t.beforeAfter}</h3>
              {Object.entries(draft.proposals).map(([employeeId, proposal]) => {
                const name = state.emps.find((employee) => employee.id === employeeId)?.name ?? employeeId;
                const changes = availabilityChanges(state, employeeId, proposal);
                return (
                  <div key={employeeId}>
                    <p className="text-sm font-medium">{name}</p>
                    {changes.length === 0 ? (
                      <p className="text-sm text-muted">{t.noCellChange}</p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-1 text-sm">
                        {changes.map((change) => (
                          <li key={`${change.day}-${change.shiftName}`} data-testid={`constraint-change-${employeeId}-${change.day}-${change.shiftName}`}>
                            {dayName(change.day, lang)} · {shiftLabel(change.shiftName, lang)} ·{" "}
                            {change.before ? t.availableWeek : t.unavailableWeek} → {change.after ? t.availableWeek : t.unavailableWeek}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">{t.nothingToWrite}</p>
          )}
        </div>
      ) : null}
      <button
        type="button"
        data-testid="approve-constraints"
        className={`${button.primary} mt-4`}
        disabled={!writable}
        onClick={() => {
          onApply(text, accepted);
          edit("");
        }}
      >
        {t.approvePaste}
      </button>
    </section>
  );
}

function lineSummary(line: ParsedLine, state: RotaState, lang: Lang): string {
  const t = copy[lang];
  if (line.status !== "recognized") return line.reason ? constraintReasonText(lang, line.reason) : "";
  const name = state.emps.find((employee) => employee.id === line.employeeId)?.name ?? line.mentioned ?? "";
  if (!line.polarity) return `${t.employeeMatched}: ${name}`;
  const days = line.days.map((day) => dayName(day, lang)).join(", ");
  const shifts = line.allShifts
    ? t.allShifts
    : line.shiftIds
        .map((id) => state.biz.shifts.find((shift) => shift.id === id)?.name)
        .filter((shiftName): shiftName is string => Boolean(shiftName))
        .map((shiftName) => shiftLabel(shiftName, lang))
        .join(", ");
  const polarity = line.polarity === "off" ? t.polarityOff : line.polarity === "on" ? t.polarityOn : t.polarityOnly;
  return `${name} · ${days} · ${polarity} · ${shifts}`;
}

function overrideSummary(override: LineOverride, state: RotaState, lang: Lang): string {
  return lineSummary(
    { ...override, raw: "", status: "recognized", source: "model" },
    state,
    lang,
  );
}

function availabilityChanges(state: RotaState, employeeId: string, proposal: string[][]) {
  const current = state.avail[state.week]?.[employeeId];
  const changes: { day: number; shiftName: string; before: boolean; after: boolean }[] = [];
  for (const shift of state.biz.shifts) {
    for (let day = 0; day < 7; day += 1) {
      if (agreementCell(state, employeeId, day, shift.id) !== "allowed") continue;
      const before = !current || (current[day] ?? []).includes(shift.id);
      const after = (proposal[day] ?? []).includes(shift.id);
      if (before !== after) changes.push({ day, shiftName: shift.name, before, after });
    }
  }
  return changes;
}

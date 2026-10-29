import { useEffect, useState } from "react";
import type { Business, Lang, RotaState, ShiftDefinition } from "../domain";
import { copy } from "../i18n/copy";
import { shiftLabel } from "../schedule/display";
import { blockBuckets, blockSplitOf, type BlockBucket, type BlockSplit } from "../people/blocks";
import { field, label, labelText } from "./ui";

function CountField({
  shown,
  label: fieldLabel,
  testId,
  readOnly,
  onCommit,
}: {
  shown: number;
  label: string;
  testId: string;
  readOnly: boolean;
  onCommit: (value: number) => void;
}) {
  const text = String(shown);
  const [draft, setDraft] = useState(text);
  useEffect(() => setDraft(text), [text]);
  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      aria-label={fieldLabel}
      data-testid={testId}
      value={draft}
      readOnly={readOnly}
      className={field}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (readOnly || next.trim() === "" || !Number.isInteger(Number(next)) || Number(next) < 0) return;
        onCommit(Number(next));
      }}
      onBlur={() => setDraft(text)}
    />
  );
}

const SPLITS: BlockSplit[] = ["general", "weekday", "shift"];

export function BlockSplitPicker({
  lang,
  split,
  readOnly,
  onChoose,
}: {
  lang: Lang;
  split: BlockSplit;
  readOnly: boolean;
  onChoose: (split: BlockSplit) => void;
}) {
  const t = copy[lang];
  const labelFor: Record<BlockSplit, string> = {
    general: t.blockSplitGeneral,
    weekday: t.blockSplitWeekday,
    shift: t.blockSplitShift,
  };
  const hintFor: Record<BlockSplit, string> = {
    general: t.blockSplitGeneralHint,
    weekday: t.blockSplitWeekdayHint,
    shift: t.blockSplitShiftHint,
  };
  return (
    <div className="mt-4">
      <div role="radiogroup" aria-label={t.blockSplitTitle} className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-line bg-card p-1">
        {SPLITS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={split === option}
            data-testid={`block-split-${option}`}
            disabled={readOnly}
            className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-50 ${
              split === option ? "bg-well font-medium text-ink" : "text-muted hover:text-ink"
            }`}
            onClick={() => onChoose(option)}
          >
            {labelFor[option]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{hintFor[split]}</p>
    </div>
  );
}

export function BlockNumberFields({
  lang,
  split,
  shifts,
  max,
  weekday,
  weekend,
  shiftCaps,
  readOnly,
  idPrefix,
  onMax,
  onWeekday,
  onWeekend,
  onShift,
}: {
  lang: Lang;
  split: BlockSplit;
  shifts: ShiftDefinition[];
  max: number;
  weekday: number;
  weekend: number;
  shiftCaps: Record<string, number>;
  readOnly: boolean;
  idPrefix: string;
  onMax: (value: number) => void;
  onWeekday: (value: number) => void;
  onWeekend: (value: number) => void;
  onShift: (shiftId: string, value: number) => void;
}) {
  const t = copy[lang];
  if (split === "shift") {
    return (
      <ul className="mt-4 flex max-w-md flex-col gap-3">
        {shifts.map((shift) => {
          const name = shiftLabel(shift.name, lang);
          return (
            <li key={shift.id} className="grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-3">
              <span className="min-w-0 text-sm text-ink">
                {name}
                <span dir="ltr" className="ms-2 text-muted">
                  {shift.start}–{shift.end}
                </span>
              </span>
              <CountField
                shown={shiftCaps[shift.id] ?? 0}
                label={name}
                testId={`${idPrefix}shift-blocks-${shift.id}`}
                readOnly={readOnly}
                onCommit={(value) => onShift(shift.id, value)}
              />
            </li>
          );
        })}
      </ul>
    );
  }
  if (split === "weekday") {
    return (
      <div className="mt-4 grid max-w-lg gap-4 sm:grid-cols-2">
        <label className={label}>
          <span className={labelText}>{t.blockWeekdays}</span>
          <CountField shown={weekday} label={t.blockWeekdays} testId={`${idPrefix}weekday-blocks`} readOnly={readOnly} onCommit={onWeekday} />
        </label>
        <label className={label}>
          <span className={labelText}>{t.blockWeekend}</span>
          <CountField shown={weekend} label={t.blockWeekend} testId={`${idPrefix}weekend-blocks`} readOnly={readOnly} onCommit={onWeekend} />
        </label>
      </div>
    );
  }
  return (
    <label className={`${label} mt-4 max-w-xs`}>
      <span className={labelText}>{t.blockLimitCount}</span>
      <CountField shown={max} label={t.blockLimitCount} testId={`${idPrefix}max-blocks`} readOnly={readOnly} onCommit={onMax} />
    </label>
  );
}

function bucketText(lang: Lang, bucket: BlockBucket, home: Business, grid: RotaState): string {
  const t = copy[lang];
  if (bucket.kind === "general") return t.blockLimitStatus(bucket.used, bucket.max);
  if (bucket.kind === "weekday") return t.blockLimitBucket(t.blockWeekdays, bucket.used, bucket.max);
  if (bucket.kind === "weekend") return t.blockLimitBucket(t.blockWeekend, bucket.used, bucket.max);
  const shifts = bucket.kind === "unmatched" ? grid.biz.shifts : home.shifts;
  const shift = shifts.find((item) => item.id === bucket.shiftId);
  const name = shift ? shiftLabel(shift.name, lang) : "";
  return t.blockLimitBucket(name, bucket.used, bucket.max);
}

/** The buckets this person is spending. `home` is the primary site, even when the grid belongs to another site. */
export function BlockLimitNote({
  state,
  employeeId,
  grid,
  home,
  lang,
  refusedIds,
  testId,
  homeName,
  away,
}: {
  state: RotaState;
  employeeId: string;
  grid: string[][] | undefined;
  home: Business;
  lang: Lang;
  refusedIds: string[];
  testId: string;
  homeName?: string;
  away?: boolean;
}) {
  if (home.blockLimit !== true) return null;
  const t = copy[lang];
  const buckets = blockBuckets(state, employeeId, grid, home).filter((bucket) => bucket.kind !== "unmatched" || bucket.used > 0);
  return (
    <div data-testid={testId} role={refusedIds.length ? "alert" : undefined} className="mt-2 flex flex-col gap-0.5">
      {away && homeName ? <p className="text-sm text-muted">{t.blockLimitHome(homeName)}</p> : null}
      {buckets.map((bucket) => {
        const hot = refusedIds.includes(bucket.id);
        return (
          <p key={bucket.id} className={`text-sm ${hot ? "font-medium text-danger-text" : "text-muted"}`}>
            {bucketText(lang, bucket, home, state)}
          </p>
        );
      })}
      {refusedIds.length ? <p className="text-sm font-medium text-danger-text">{t.blockLimitReached}</p> : null}
    </div>
  );
}

export { blockSplitOf };

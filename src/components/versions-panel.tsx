"use client";

import { useState } from "react";
import { diffIsEmpty, diffSchedules, weekVersions, type Lang, type RotaState, type ScheduleDiff } from "../domain";
import { copy, restoredDraftText, restoredFromText, sinceVersionText, versionLabel } from "../i18n/copy";
import { employeeName } from "../people/edit";
import { slotTitle } from "../schedule/display";
import { clockLabel } from "../schedule/edit";
import { button, pill, surface } from "./ui";

export function VersionsPanel({
  state,
  lang,
  canRestore,
  onRestore,
}: {
  state: RotaState;
  lang: Lang;
  canRestore: boolean;
  onRestore: (versionId: string) => void;
}) {
  const t = copy[lang];
  const schedule = state.sched[state.week];
  const versions = weekVersions(state);
  const latest = versions.at(-1);
  const pending = latest && schedule ? diffSchedules(latest.schedule, schedule) : null;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  function toggle(id: string) {
    setOpen((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <section data-testid="versions" className={`${surface} p-4 sm:p-5`}>
      <h2 className="mb-3 text-base font-semibold tracking-tight">{t.versionsTitle}</h2>
      {schedule?.restoredFrom && schedule.status === "draft" ? (
        <p data-testid="restored-banner" className="mb-3 rounded-lg bg-warn-soft px-3 py-2 text-xs font-medium text-warn-text">
          {restoredDraftText(lang, schedule.restoredFrom)}
        </p>
      ) : null}
      {latest && pending && !diffIsEmpty(pending) ? (
        <div data-testid="pending-diff" className="mb-3 rounded-lg border border-line bg-well px-3 py-2">
          <div className="flex items-center gap-1">
            <ChangeToggle
              open={open.pending === true}
              testId="pending-changes"
              label={open.pending ? t.hideChanges : t.showChanges}
              onToggle={() => toggle("pending")}
            />
            <p className="text-xs font-medium">{sinceVersionText(lang, latest.number)}</p>
          </div>
          {open.pending ? <DiffList state={state} lang={lang} diff={pending} /> : null}
        </div>
      ) : null}
      {versions.length === 0 ? (
        <p className="text-xs text-subtle">{t.noVersions}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {versions.map((version, index) => ({ version, previous: versions[index - 1] })).reverse().map(({ version, previous }) => {
            const diff = previous ? diffSchedules(previous.schedule, version.schedule) : null;
            const changes = diff != null && !diffIsEmpty(diff);
            const shown = open[version.id] === true;
            return (
              <li key={version.id} data-testid={`version-${version.number}`} className="rounded-xl border border-line bg-paper px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {changes ? (
                    <ChangeToggle
                      open={shown}
                      testId={`version-changes-${version.number}`}
                      label={shown ? t.hideChanges : t.showChanges}
                      onToggle={() => toggle(version.id)}
                    />
                  ) : null}
                  <span className="font-semibold">{versionLabel(lang, version.number)}</span>
                  <span className={`${pill} bg-ok-soft text-ok-text`}>
                    {version.reason === "publish" ? t.versionPublish : version.reason === "trade" ? t.versionTrade : t.versionCalloff}
                  </span>
                  <time dateTime={version.at} className="text-subtle">
                    {new Date(version.at).toLocaleString(lang === "he" ? "he-IL" : "en-GB", {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {version.restoredFrom ? <span className="text-warn-text">{restoredFromText(lang, version.restoredFrom)}</span> : null}
                  {canRestore ? (
                    <button
                      type="button"
                      data-testid={`restore-${version.number}`}
                      className={`${button.small} ms-auto h-7`}
                      onClick={() => onRestore(version.id)}
                    >
                      {t.restoreVersion}
                    </button>
                  ) : null}
                </div>
                {changes && shown && diff ? <DiffList state={state} lang={lang} diff={diff} /> : null}
                {diff && !changes ? <p className="mt-1 text-xs text-subtle">{t.noDiff}</p> : null}
                {!diff ? <p className="mt-1 text-xs text-subtle">{t.firstVersion}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ChangeToggle({
  open,
  testId,
  label,
  onToggle,
}: {
  open: boolean;
  testId: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-expanded={open}
      aria-label={label}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-well hover:text-ink"
      onClick={onToggle}
    >
      <span aria-hidden className="text-xs leading-none">
        {open ? "▴" : "▾"}
      </span>
    </button>
  );
}

function DiffList({ state, lang, diff }: { state: RotaState; lang: Lang; diff: ScheduleDiff }) {
  const t = copy[lang];
  const name = (employeeId: string) => employeeName(state, employeeId);
  const seat = (slotKey: string) => {
    const [day, shiftId] = slotKey.split("|");
    return state.biz.shifts.some((shift) => shift.id === shiftId) ? slotTitle(state, { day: Number(day), shiftId }, lang) : slotKey;
  };
  const hours = (value?: { start: number; end: number }) => (value ? `${clockLabel(value.start)}–${clockLabel(value.end)}` : "—");

  return (
    <ul data-testid="diff" className="mt-1 flex flex-col gap-0.5 text-xs">
      {diff.added.map((item) => (
        <li key={`a-${item.slotKey}-${item.employeeId}`} className="text-ok-text">
          + {t.diffAdded}: {name(item.employeeId)} · {seat(item.slotKey)}
        </li>
      ))}
      {diff.removed.map((item) => (
        <li key={`r-${item.slotKey}-${item.employeeId}`} className="text-danger-text">
          − {t.diffRemoved}: {name(item.employeeId)} · {seat(item.slotKey)}
        </li>
      ))}
      {diff.extensions.map((item) => (
        <li key={`e-${item.slotKey}-${item.employeeId}`} className="text-warn-text">
          ↔ {t.diffExtended}: {name(item.employeeId)} · {seat(item.slotKey)} ·{" "}
          <span dir="ltr">
            {hours(item.before)} → {hours(item.after)}
          </span>
        </li>
      ))}
      {diff.calloffs.map((item) => (
        <li key={`c-${item.id}`} className="text-danger-text">
          ! {t.diffCalledOff}: {item.name} · {seat(item.slotKey)}
        </li>
      ))}
    </ul>
  );
}

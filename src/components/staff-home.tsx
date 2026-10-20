import { useState, type ReactNode } from "react";
import { addDays, agreementAllows, slots, type Lang, type RotaState } from "../domain";
import { copy } from "../i18n/copy";
import { exportFileName, formatWeekRange, pngFileName, siteLabel } from "../schedule/display";
import { calendarTitle, ownPublishedShifts, shiftsIcs } from "../schedule/calendar";
import { constraintWindowOpen, constraintWindowText } from "../schedule/constraint-window";
import { weekCsv, weekExcelXml, weekExport, weekText } from "../schedule/export";
import type { StaffDecision, StaffRequest } from "../workspace/workspace";
import { WeekGrid } from "./team-screen";
import { WeekBoard } from "./schedule-board";
import { BrandMark, Wordmark } from "./login-screen";
import { downloadBlob, downloadWeekPng } from "./week-png";
import { availabilitySubmitted, blockLimitOf, countBlocks, gridWithCell, openAvailabilityGrid, withinBlockLimit } from "../people/edit";
import { button, card, cardTitle, pill } from "./ui";

function officialGrid(state: RotaState, employeeId: string): string[][] {
  const submitted = state.avail[state.week]?.[employeeId];
  if (submitted) return submitted.map((day) => [...day]);
  const employee = state.emps.find((item) => item.id === employeeId);
  return [0, 1, 2, 3, 4, 5, 6].map((day) =>
    state.biz.shifts.filter((shift) => employee && agreementAllows(employee, day, shift.id) && Number(shift.req[day] || 0) > 0).map((shift) => shift.id),
  );
}

function sameGrid(left: string[][], right: string[][]): boolean {
  return [0, 1, 2, 3, 4, 5, 6].every((day) => {
    const a = new Set(left[day] ?? []);
    const b = right[day] ?? [];
    return a.size === new Set(b).size && b.every((id) => a.has(id));
  });
}

function withGrid(state: RotaState, employeeId: string, grid: string[][]): RotaState {
  return {
    ...state,
    avail: { ...state.avail, [state.week]: { ...state.avail[state.week], [employeeId]: grid } },
  };
}

function StaffConstraints({
  state,
  lang,
  employeeId,
  pending,
  onSubmit,
}: {
  state: RotaState;
  lang: Lang;
  employeeId: string;
  pending: StaffRequest | null;
  onSubmit: (shifts: string[][]) => void;
}) {
  const t = copy[lang];
  const employee = state.emps.find((item) => item.id === employeeId);
  const accessOn = state.biz.staffAccess !== false;
  const open = accessOn && constraintWindowOpen(state.biz);
  const locked = Boolean(pending) || !open;
  const [draft, setDraft] = useState<string[][]>(() => (pending ? pending.shifts.map((day) => [...day]) : officialGrid(state, employeeId)));
  const [refused, setRefused] = useState(false);
  const limit = blockLimitOf(state.biz);
  const shown = withGrid(state, employeeId, pending ? pending.shifts : draft);
  const approved = state.avail[state.week]?.[employeeId];
  const unchanged = Boolean(approved) && sameGrid(approved ?? [], draft);
  if (!employee) return null;
  return (
    <section data-testid="staff-constraints" className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className={cardTitle}>{employee.name}</h1>
        <span className={`${pill} ${availabilitySubmitted(state, employee.id) ? "bg-ok-soft text-ok-text" : "bg-well text-muted"}`}>
          {availabilitySubmitted(state, employee.id) ? t.submittedShort : t.notSubmittedShort}
        </span>
        <div className="ms-auto flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="staff-mark-all"
            className={button.small}
            disabled={locked}
            onClick={() => {
              setRefused(false);
              setDraft(openAvailabilityGrid(state, employeeId));
            }}
          >
            {t.markAll}
          </button>
          <button
            type="button"
            data-testid="staff-clear-all"
            className={button.small}
            disabled={locked}
            onClick={() => {
              const cleared = [[], [], [], [], [], [], []];
              if (!withinBlockLimit(state, employeeId, cleared)) {
                setRefused(true);
                return;
              }
              setRefused(false);
              setDraft(cleared);
            }}
          >
            {t.clearEverything}
          </button>
          <button
            type="button"
            className={button.quiet}
            disabled={locked}
            onClick={() => {
              const previous = state.avail[addDays(state.week, -7)]?.[employeeId];
              const next = previous
                ? [0, 1, 2, 3, 4, 5, 6].map((day) =>
                    (previous[day] ?? []).filter((shiftId) => agreementAllows(employee, day, shiftId) && Number(state.biz.shifts.find((shift) => shift.id === shiftId)?.req[day] || 0) > 0),
                  )
                : officialGrid({ ...state, avail: {} }, employeeId);
              if (!withinBlockLimit(state, employeeId, next)) {
                setRefused(true);
                return;
              }
              setRefused(false);
              setDraft(next);
            }}
          >
            {t.copyPrevious}
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{t.staffConstraintsHint}</p>
      {pending ? (
        <p data-testid="staff-pending" className="mt-2 text-sm font-medium text-ink">
          {t.staffPending}
        </p>
      ) : !accessOn ? (
        <p role="alert" className="mt-2 text-sm font-medium text-ink">
          {t.staffAccessOff}
        </p>
      ) : !open ? (
        <p role="alert" data-testid="staff-window-closed" className="mt-2 text-sm font-medium text-ink">
          {t.staffWindowClosed}: {constraintWindowText(state.biz, lang)}
        </p>
      ) : null}
      {limit !== null ? (
        <p data-testid="staff-block-limit" role={refused ? "alert" : undefined} className={`mt-2 text-sm ${refused ? "font-medium text-danger-text" : "text-muted"}`}>
          {t.blockLimitStatus(countBlocks(state, employeeId, draft), limit)}
          {refused ? ` ${t.blockLimitReached}` : ""}
        </p>
      ) : null}
      <WeekGrid
        state={shown}
        lang={lang}
        employeeId={employee.id}
        mode="availability"
        editable={!locked}
        onToggle={(day, shiftId, checked) => {
          const next = gridWithCell(state, employeeId, draft, day, shiftId, checked);
          if (!withinBlockLimit(state, employeeId, next)) {
            setRefused(true);
            return;
          }
          setRefused(false);
          setDraft(next);
        }}
      />
      {!locked && unchanged ? (
        <p data-testid="staff-same-request" className="mt-4 text-sm text-muted">
          {t.staffSameRequest}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="submit-request"
        className={`${button.primary} mt-4`}
        disabled={locked || unchanged}
        onClick={() => {
          if (!withinBlockLimit(state, employeeId, draft)) {
            setRefused(true);
            return;
          }
          onSubmit(draft);
        }}
      >
        {t.staffSubmit}
      </button>
    </section>
  );
}

function DecisionNotice({
  decision,
  lang,
  onClose,
}: {
  decision: StaffDecision;
  lang: Lang;
  onClose: () => Promise<boolean>;
}) {
  const t = copy[lang];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = decision.outcome === "approved" ? t.requestApproved : t.requestRejected;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-decision-title"
        data-testid="request-decision"
        data-outcome={decision.outcome}
        className={`${card} w-full max-w-md`}
      >
        <h2 id="request-decision-title" className={cardTitle}>
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          {formatWeekRange(decision.week, lang)}
          {decision.siteName ? ` · ${siteLabel(decision.siteName, lang)}` : ""}
        </p>
        {failed ? (
          <p role="alert" className="mt-2 text-sm text-danger-text">
            {t.saveFailed}
          </p>
        ) : null}
        <button
          type="button"
          data-testid="request-decision-close"
          className={`${button.primary} mt-4`}
          disabled={busy}
          autoFocus
          onClick={() => {
            setBusy(true);
            setFailed(false);
            void onClose().then((ok) => {
              if (!ok) {
                setFailed(true);
                setBusy(false);
              }
            });
          }}
        >
          {t.requestDecisionOk}
        </button>
      </div>
    </div>
  );
}

function downloadIcs(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** The signed-in employee's home: their constraints, and the week after it is published. */
export function StaffHome({
  state,
  lang,
  orgName,
  selfId,
  sites,
  rosterSites,
  activeSiteId,
  toolbar,
  saveNote,
  onSelectSite,
  pending,
  onSubmit,
  onWeek,
  decisions,
  onAcknowledge,
}: {
  state: RotaState;
  lang: Lang;
  orgName: string;
  selfId: string | null;
  sites: { id: string; name: string }[];
  rosterSites: { id: string; name: string; state: RotaState }[];
  activeSiteId: string;
  toolbar: ReactNode;
  saveNote: string | null;
  onSelectSite: (siteId: string) => void;
  pending: StaffRequest | null;
  onSubmit: (shifts: string[][]) => void;
  onWeek: (days: number) => void;
  decisions: StaffDecision[];
  onAcknowledge: (requestId: string) => Promise<boolean>;
}) {
  const t = copy[lang];
  const [tab, setTab] = useState<"schedule" | "constraints">("schedule");
  const [copied, setCopied] = useState(false);
  const employee = selfId ? state.emps.find((item) => item.id === selfId) ?? null : null;
  const siteName = siteLabel(state.biz.name, lang);
  const title = calendarTitle(siteName, orgName);
  const mine = selfId
    ? rosterSites.flatMap((site) =>
        ownPublishedShifts({ ...site.state, week: state.week }, selfId).map((shift) => ({
          ...shift,
          title: calendarTitle(siteLabel(site.name, lang), orgName),
        })),
      )
    : [];
  const boards = selfId ? rosterSites.filter((site) => site.state.emps.some((employee) => employee.id === selfId)) : [];
  const publishedStates = boards.map((site) => ({ ...site.state, week: state.week })).filter((view) => view.sched[view.week]?.status === "published");
  const hasPublished = publishedStates.length > 0;
  const decision = decisions[0] ?? null;
  const tabs = [
    { id: "schedule" as const, label: t.staffSchedule },
    { id: "constraints" as const, label: t.staffConstraints },
  ];

  return (
    <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur-xl">
        {saveNote ? (
          <p role="alert" className="mx-auto max-w-[1440px] px-4 pt-2 text-sm text-danger-text sm:px-6">
            {saveNote === "db"
              ? t.remoteDbMissing
              : saveNote === "blocks"
                ? t.blockLimitReached
                : saveNote === "same"
                  ? t.staffSameRequest
                  : t.saveFailed}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BrandMark />
            <Wordmark />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {sites.length > 1 ? (
              <select
                data-testid="site-select"
                aria-label={t.site}
                className={`${button.quiet} max-w-36 px-3 sm:max-w-none`}
                value={activeSiteId}
                onChange={(event) => onSelectSite(event.target.value)}
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {siteLabel(site.name, lang)}
                  </option>
                ))}
              </select>
            ) : null}
            {toolbar}
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] px-4 pb-3 sm:px-6">
          <nav role="tablist" aria-label="Rota" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-track p-1 sm:inline-flex">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                data-testid={`staff-nav-${item.id}`}
                aria-selected={tab === item.id}
                className={`min-h-9 rounded-lg px-4 py-2 text-center text-sm font-medium ${
                  tab === item.id ? "bg-card font-semibold text-ink shadow-card" : "text-muted hover:bg-card/50 hover:text-ink"
                }`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1 shadow-card">
            <button type="button" data-testid="prev-week" aria-label={t.previousWeek} className="grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-ink-soft hover:bg-well hover:text-ink" onClick={() => onWeek(-7)}>
              ‹
            </button>
            <p className="min-w-36 px-2 text-center text-sm font-medium tabular-nums">{formatWeekRange(state.week, lang)}</p>
            <button type="button" data-testid="next-week" aria-label={t.nextWeek} className="grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-ink-soft hover:bg-well hover:text-ink" onClick={() => onWeek(7)}>
              ›
            </button>
          </div>
        </section>
        {!selfId ? (
          <p className={`${card} text-sm leading-6 text-ink`}>{t.staffUnlinked}</p>
        ) : tab === "constraints" ? (
          employee ? (
            <StaffConstraints
              key={`${activeSiteId}-${state.week}-${employee.id}-${pending?.id ?? "open"}`}
              state={state}
              lang={lang}
              employeeId={employee.id}
              pending={pending}
              onSubmit={onSubmit}
            />
          ) : (
            <p className={`${card} text-sm leading-6 text-ink`}>{t.staffUnlinked}</p>
          )
        ) : (
          <section data-testid="staff-schedule" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="add-to-calendar"
                className={button.primary}
                disabled={mine.length === 0}
                onClick={() => {
                  if (!selfId || mine.length === 0) return;
                  downloadIcs("work.ics", shiftsIcs({ title, week: state.week, employeeId: selfId, shifts: mine }));
                }}
              >
                {t.addToCalendar}
              </button>
              <button
                type="button"
                data-testid="staff-export-excel"
                className={button.quiet}
                disabled={!hasPublished}
                onClick={() => {
                  const xml = weekExcelXml(publishedStates, lang, orgName, selfId ?? undefined);
                  if (!xml) return;
                  downloadBlob(new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }), exportFileName(siteName, state.week, "xls"));
                }}
              >
                {t.exportExcel}
              </button>
              <button
                type="button"
                data-testid="staff-export-csv"
                className={button.quiet}
                disabled={!hasPublished}
                onClick={() => {
                  const csv = weekCsv(publishedStates, lang, selfId ?? undefined);
                  if (!csv) return;
                  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), exportFileName(siteName, state.week, "csv"));
                }}
              >
                {t.exportCsv}
              </button>
              <button
                type="button"
                data-testid="staff-export-png"
                className={button.quiet}
                disabled={!hasPublished}
                onClick={() => {
                  for (const view of publishedStates) {
                    const data = weekExport(view, lang, orgName);
                    if (!data) continue;
                    downloadWeekPng(
                      data,
                      { open: t.exportOpen, closed: t.exportClosed, covered: t.covered, overQuota: t.overQuota, legend: t.exportLegend },
                      pngFileName(siteLabel(view.biz.name, lang), view.week),
                    );
                  }
                }}
              >
                {t.exportPng}
              </button>
              <button
                type="button"
                data-testid="staff-export-text"
                className={button.quiet}
                disabled={!hasPublished}
                onClick={() => {
                  const text = weekText(publishedStates, lang, orgName, selfId ?? undefined);
                  if (!text) return;
                  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                    void navigator.clipboard.writeText(text).then(() => {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    });
                  } else {
                    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), exportFileName(siteName, state.week, "txt"));
                  }
                }}
              >
                {copied ? t.exportTextCopied : t.exportText}
              </button>
              {mine.length === 0 ? <p className="text-sm text-muted">{t.calendarEmpty}</p> : null}
            </div>
            {boards.map((site) => {
              const view = { ...site.state, week: state.week };
              const open = view.sched[view.week]?.status === "published";
              return (
                <section key={site.id} data-testid={`staff-site-${site.id}`} className="flex flex-col gap-3">
                  <h2 className={cardTitle}>{siteLabel(site.name, lang)}</h2>
                  {open ? (
                    <WeekBoard
                      state={view}
                      slots={slots(view, view.week)}
                      lang={lang}
                      published
                      canCallOff={false}
                      nowHours={null}
                      selectedToken={null}
                      focusEmployeeId={selfId}
                      onAdd={() => undefined}
                      onRemove={() => undefined}
                      onMove={() => undefined}
                      onSwap={() => undefined}
                      onToggleSelect={() => undefined}
                      onCallOff={() => undefined}
                    />
                  ) : (
                    <p className={`${card} text-sm leading-6 text-ink`}>{t.staffUnpublished}</p>
                  )}
                </section>
              );
            })}
          </section>
        )}
      </main>
      {decision ? <DecisionNotice key={decision.id} decision={decision} lang={lang} onClose={() => onAcknowledge(decision.id)} /> : null}
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { addDays, slots, type Business, type Lang, type RotaState } from "../domain";
import { copy } from "../i18n/copy";
import { exportFileName, formatWeekRange, pngFileName, siteLabel } from "../schedule/display";
import { calendarTitle, ownPublishedShifts, shiftsIcs } from "../schedule/calendar";
import { hebrewWeekRange } from "../schedule/hebrew-calendar";
import { constraintWindowOpen, constraintWindowText, staffCanSubmitConstraints, staffConstraintWeek, underwayWeek } from "../schedule/constraint-window";
import { useCountdown } from "./duration-wheel";
import { weekCsv, weekExcelXml, weekExport, weekText } from "../schedule/export";
import type { StaffDecision, StaffRequest } from "../workspace/workspace";
import { AttendanceScreen, type AttendanceApi } from "./attendance";
import { WeekGrid } from "./team-screen";
import { WeekBoard } from "./schedule-board";
import { Logo } from "./login-screen";
import { RailIcon } from "./rail-icon";
import { downloadBlob, downloadWeekPng } from "./week-png";
import { useHebrewCalendar } from "./day-dates";
import { StaffTrades, type ShiftTrade, type TradeApi } from "./trades";
import { StaffEnvelopeButton, StaffMessageInbox, StaffMessagePopup } from "./staff-messages";
import type { ManagerMessage } from "../db/messages";
import { AbsenceScreen, type AbsencesApi } from "./absence-screen";
import type { AbsenceRequest } from "../db/absences";
import { WeekPicker } from "./week-picker";
import { overBucketIds } from "../people/blocks";
import { availabilitySubmitted, gridWithCell, hasConstraintGrant, openAvailabilityGrid, openConstraintShiftIds } from "../people/edit";
import { BlockLimitNote } from "./block-limit";
import { button, card, cardTitle, pill } from "./ui";

function officialGrid(state: RotaState, employeeId: string): string[][] {
  const submitted = state.avail[state.week]?.[employeeId];
  if (submitted) return submitted.map((day) => [...day]);
  const employee = state.emps.find((item) => item.id === employeeId);
  return [0, 1, 2, 3, 4, 5, 6].map((day) =>
    employee ? openConstraintShiftIds(state, employeeId, day) : [],
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
  home,
  homeName,
  away,
  onSubmit,
}: {
  state: RotaState;
  lang: Lang;
  employeeId: string;
  pending: StaffRequest | null;
  home: Business;
  homeName: string;
  away: boolean;
  onSubmit: (shifts: string[][]) => void;
}) {
  const t = copy[lang];
  const employee = state.emps.find((item) => item.id === employeeId);
  const accessOn = state.biz.staffAccess !== false;
  const open = accessOn && constraintWindowOpen(state.biz);
  const [draft, setDraft] = useState<string[][]>(() => (pending ? pending.shifts.map((day) => [...day]) : officialGrid(state, employeeId)));
  const [refused, setRefused] = useState<string[]>([]);
  const [sameNotice, setSameNotice] = useState(false);
  const limited = home.blockLimit === true;
  const granted = hasConstraintGrant(state, employeeId);
  const capped = limited && !granted;
  const over = capped && overBucketIds(state, employeeId, draft, home).length > 0;
  const countdown = useCountdown(state.biz.constraintExtensionUntil);
  const approved = state.avail[state.week]?.[employeeId];
  const waiting = Boolean(pending) && !(approved && sameGrid(approved, pending?.shifts ?? []));
  const weekAllowed = staffCanSubmitConstraints(state.week);
  const locked = waiting || !open || !weekAllowed;
  const shown = withGrid(state, employeeId, waiting && pending ? pending.shifts : draft);
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
              setRefused([]);
              setSameNotice(false);
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
              const blocked = capped ? overBucketIds(state, employeeId, cleared, home) : [];
              if (blocked.length) {
                setRefused(blocked);
                return;
              }
              setRefused([]);
              setSameNotice(false);
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
                ? [0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const open = new Set(openConstraintShiftIds(state, employeeId, day));
                    return (previous[day] ?? []).filter((shiftId) => open.has(shiftId));
                  })
                : officialGrid({ ...state, avail: {} }, employeeId);
              const blocked = capped ? overBucketIds(state, employeeId, next, home) : [];
              if (blocked.length) {
                setRefused(blocked);
                return;
              }
              setRefused([]);
              setSameNotice(false);
              setDraft(next);
            }}
          >
            {t.copyPrevious}
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {!limited ? t.staffConstraintsHint : granted ? t.exceptionGranted : t.staffAutoHint}
      </p>
      {countdown ? (
        <p data-testid="staff-extra-window" className="mt-2 text-sm font-medium tabular-nums text-ink">
          {t.extraWindowRemaining(countdown)}
        </p>
      ) : null}
      {waiting ? (
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
      ) : !weekAllowed ? (
        <p role="alert" data-testid="staff-week-only" className="mt-2 text-sm font-medium text-ink">
          {t.staffWeekOnly}
        </p>
      ) : null}
      {capped ? (
        <BlockLimitNote
          state={state}
          employeeId={employeeId}
          grid={draft}
          home={home}
          lang={lang}
          refusedIds={refused}
          testId="staff-block-limit"
          homeName={homeName}
          away={away}
        />
      ) : null}
      <WeekGrid
        state={shown}
        lang={lang}
        employeeId={employee.id}
        mode="availability"
        editable={!locked}
        onToggle={(day, shiftId, checked) => {
          const next = gridWithCell(state, employeeId, draft, day, shiftId, checked);
          const blocked = capped ? overBucketIds(state, employeeId, next, home) : [];
          if (blocked.length) {
            setRefused(blocked);
            return;
          }
          setRefused([]);
          setSameNotice(false);
          setDraft(next);
        }}
      />
      {sameNotice ? (
        <p data-testid="staff-same-request" className="mt-4 text-sm text-muted">
          {t.staffSameRequest}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="submit-request"
        className={`${button.primary} mt-4`}
        disabled={locked || over}
        onClick={() => {
          if (approved && sameGrid(approved, draft)) {
            setSameNotice(true);
            return;
          }
          setSameNotice(false);
          onSubmit(draft);
        }}
      >
        {limited ? t.staffSave : t.staffSubmit}
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
  const hebrew = useHebrewCalendar();
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
        {hebrew ? <p className="text-xs text-muted">{hebrewWeekRange(decision.week, lang)}</p> : null}
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

/** The signed-in employee's home. Clock-in and clock-out open first. */
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
  trades = [],
  takeable = [],
  tradeApi,
  attendanceApi,
  messages = [],
  onMessageAck,
  absences = [],
  absencesApi,
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
  trades?: ShiftTrade[];
  takeable?: string[];
  /** Swaps and giveaways go through the server, so they are off without one. */
  tradeApi?: TradeApi;
  attendanceApi: AttendanceApi;
  messages?: ManagerMessage[];
  onMessageAck?: (messageId: string, kind: "popup" | "read") => Promise<boolean>;
  absences?: AbsenceRequest[];
  absencesApi?: AbsencesApi;
}) {
  const t = copy[lang];
  const hebrew = useHebrewCalendar();
  const [tab, setTab] = useState<"attendance" | "schedule" | "constraints" | "absences">("attendance");
  const activeNav = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const employee = selfId ? state.emps.find((item) => item.id === selfId) ?? null : null;
  const homeSite = employee?.homeSiteId ? rosterSites.find((site) => site.id === employee.homeSiteId) : undefined;
  const homeBiz = homeSite?.state.biz ?? state.biz;
  const homeName = homeSite ? siteLabel(homeSite.name, lang) : siteLabel(state.biz.name, lang);
  const homeAway = Boolean(employee?.homeSiteId && employee.homeSiteId !== activeSiteId && homeSite);
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
    { id: "attendance" as const, label: t.staffAttendance },
    { id: "schedule" as const, label: t.staffSchedule },
    { id: "constraints" as const, label: t.staffConstraints },
    { id: "absences" as const, label: t.staffAbsences },
  ];

  const pageTitle = tabs.find((item) => item.id === tab)?.label ?? "";

  function weekDelta(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  }

  function openTab(next: "attendance" | "schedule" | "constraints" | "absences") {
    if (next === tab) return;
    setTab(next);
    const target = next === "constraints" ? staffConstraintWeek() : next === "schedule" ? underwayWeek() : null;
    if (!target) return;
    const delta = weekDelta(state.week, target);
    if (delta !== 0) onWeek(delta);
  }

  useEffect(() => {
    activeNav.current?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [tab]);

  return (
    <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="shell min-h-dvh bg-page text-ink">
      <div className="flex min-h-dvh flex-col md:flex-row">
        <aside className="sticky top-0 z-30 flex w-full shrink-0 flex-col border-b border-line bg-paper md:h-dvh md:w-56 md:self-start md:border-e md:border-b-0">
          <div className="flex h-14 shrink-0 items-center px-4 md:h-16 md:px-5">
            <Logo className="h-7" />
          </div>
          <p className="hidden px-5 pb-2 text-[11px] font-medium uppercase tracking-[0.06em] text-muted md:block">{t.staffRail}</p>
          <nav role="tablist" aria-label="Rota" className="flex gap-0.5 overflow-x-auto px-2 pb-2 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:px-3 md:pb-4">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                data-testid={`staff-nav-${item.id}`}
                ref={tab === item.id ? activeNav : undefined}
                aria-selected={tab === item.id}
                className={`flex min-h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] leading-5 md:w-full ${
                  tab === item.id ? "bg-well font-medium text-ink" : "text-muted hover:bg-well/80 hover:text-ink"
                }`}
                onClick={() => openTab(item.id)}
              >
                <RailIcon name={item.id} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
      {saveNote ? (
        <p role="alert" className="bg-danger-softer px-6 py-2 text-sm text-danger-text sm:px-8">
          {saveNote === "db"
            ? t.remoteDbMissing
            : saveNote === "blocks"
              ? t.blockLimitReached
              : saveNote === "same"
                ? t.staffSameRequest
                : saveNote === "week"
                  ? t.staffWeekOnly
                  : saveNote === "home"
                    ? t.constraintHomeOnly
                    : t.saveFailed}
        </p>
      ) : null}
      <main className="flex flex-col gap-8 px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink">{pageTitle}</h1>
            <p className="mt-2 text-sm text-muted">{siteName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selfId ? (
              <StaffEnvelopeButton
                lang={lang}
                unread={messages.filter((row) => !row.readAt).length}
                open={inboxOpen}
                onToggle={() => {
                  const next = !inboxOpen;
                  setInboxOpen(next);
                  if (next && onMessageAck) {
                    void Promise.all(messages.filter((row) => !row.readAt).map((row) => onMessageAck(row.id, "read")));
                  }
                }}
              />
            ) : null}
            {sites.length > 1 ? (
              <select
                data-testid="site-select"
                aria-label={t.site}
                className={`${button.quiet} max-w-44 px-3`}
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
        {tab === "attendance" || tab === "absences" ? null : (
          <section className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-line bg-card p-1">
              <button type="button" data-testid="prev-week" aria-label={t.previousWeek} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-well hover:text-ink" onClick={() => onWeek(-7)}>
                <Chevron dir="prev" />
              </button>
              <WeekPicker
                lang={lang}
                week={state.week}
                onPick={(sunday) => onWeek(weekDelta(state.week, sunday))}
              />
              <button type="button" data-testid="next-week" aria-label={t.nextWeek} className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-well hover:text-ink" onClick={() => onWeek(7)}>
                <Chevron dir="next" />
              </button>
            </div>
          </section>
        )}
        {selfId && tradeApi ? (
          <StaffTrades
            lang={lang}
            selfId={selfId}
            week={state.week}
            sites={boards}
            trades={trades}
            takeable={takeable}
            panel={tab === "schedule"}
            quiet={Boolean(decision)}
            api={tradeApi}
          />
        ) : null}
        {!selfId ? (
          <p className={`${card} text-sm leading-6 text-ink`}>{t.staffUnlinked}</p>
        ) : tab === "attendance" ? (
          <AttendanceScreen lang={lang} siteId={activeSiteId} api={attendanceApi} />
        ) : tab === "absences" && absencesApi ? (
          <AbsenceScreen lang={lang} canWrite={Boolean(selfId)} manager={false} requests={absences} api={absencesApi} />
        ) : tab === "constraints" ? (
          employee ? (
            <StaffConstraints
              key={`${homeAway && homeSite ? homeSite.id : activeSiteId}-${state.week}-${employee.id}-${pending?.id ?? "open"}`}
              state={homeAway && homeSite ? { ...homeSite.state, week: state.week } : state}
              lang={lang}
              employeeId={employee.id}
              pending={pending}
              home={homeBiz}
              homeName={homeName}
              away={homeAway}
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
                  const xml = weekExcelXml(publishedStates, lang, orgName, selfId ?? undefined, hebrew);
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
                  const csv = weekCsv(publishedStates, lang, selfId ?? undefined, hebrew);
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
                    const data = weekExport(view, lang, orgName, hebrew);
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
                  const text = weekText(publishedStates, lang, orgName, selfId ?? undefined, hebrew);
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
                      onHours={() => undefined}
                      onRequired={() => undefined}
                      onToggleLock={() => undefined}
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
        </div>
      </div>
      {decision ? <DecisionNotice key={decision.id} decision={decision} lang={lang} onClose={() => onAcknowledge(decision.id)} /> : null}
      {inboxOpen ? <StaffMessageInbox lang={lang} messages={messages} onClose={() => setInboxOpen(false)} /> : null}
      {!inboxOpen && !decision
        ? messages
            .filter((row) => !row.seenPopupAt)
            .slice(0, 1)
            .map((row) => (
              <StaffMessagePopup
                key={row.id}
                lang={lang}
                message={row}
                onClose={() => (onMessageAck ? onMessageAck(row.id, "popup") : Promise.resolve(true))}
              />
            ))
        : null}
    </div>
  );
}

function Chevron({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="week-chevron h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "prev" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
    </svg>
  );
}

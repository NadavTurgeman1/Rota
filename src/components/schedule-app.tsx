"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addDays, analyze, slots, sundayOnOrBefore, type Analysis, type Lang, type RotaState } from "../domain";
import { addShift, removeShift, setShiftRequirement, updateBusiness, updateShift } from "../business/edit";
import { DEMO_PASSWORD, DEMO_USERS, SENTINEL_FALLBACK_WEEK, sentinelWorkspace } from "../demo/sentinel";
import { copy, deleteEmployeeBlocked, publishBlocked, selectionHint } from "../i18n/copy";
import { formatWeekRange, pngFileName, siteLabel } from "../schedule/display";
import { backupJson, weekExport } from "../schedule/export";
import {
  addEmployee,
  approveProposal,
  commit,
  approveEmergency,
  approveReplacement,
  freshStamp,
  generateWeek,
  goToWeek,
  hoursSinceWeek,
  moveEmployee,
  swapInSlot,
  parseAssignmentToken,
  publishCheck,
  publishWeek,
  redo,
  removeEmployee,
  reportCallOff,
  restoreWeekVersion,
  revertToDraft,
  undo,
  type History,
} from "../schedule/edit";
import {
  DEMO_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  readDemoSave,
  readWorkspaceSave,
  writeWorkspaceSave,
} from "../schedule/storage";
import {
  addEmployeeRecord,
  applyConstraintText,
  copyAvailability,
  deletionBlockedBy,
  employeeName,
  removeEmployeeRecord,
  setAgreement,
  setWholeAgreement,
  setAvailability,
  updateEmployee,
  VIEWER,
} from "../people/edit";
import {
  actorFor,
  activeSite,
  addSite,
  authenticate,
  canWrite as hasWrite,
  isOwner,
  removeSite,
  renameSiteAllowed,
  selectSite,
  updateOrg,
  withSiteState,
  type Workspace,
} from "../workspace/workspace";
import { BusinessScreen } from "./business-screen";
import { ConstraintsScreen } from "./constraints-screen";
import { InsightsScreen } from "./insights-screen";
import { IssuesPanel } from "./issues-panel";
import { BrandMark, CreateOrgScreen, LoginScreen, Wordmark } from "./login-screen";
import { browserClient } from "../supabase/browser";
import { remoteConfigured } from "../supabase/public-env";
import { WeekBoard } from "./schedule-board";
import { TeamScreen } from "./team-screen";
import { useAiEnabled } from "./use-ai";
import { SettingsMenu, type Theme } from "./settings-menu";
import { VersionsPanel } from "./versions-panel";
import { WeekSummary } from "./week-summary";
import { button } from "./ui";
import { downloadBlob, downloadWeekPng } from "./week-png";

const EMPTY: Analysis = { violations: [], overQuota: [], unfilled: [], under: [], hours: {}, counts: {} };
const THEME_KEY = "rota.theme";

function persistable(workspace: Workspace) {
  return { org: workspace.org, sites: workspace.sites, activeSiteId: workspace.activeSiteId };
}

function blankWorkspace(userId: string, email: string): Workspace {
  const name = email.split("@")[0] || "Rota";
  return {
    org: { id: "", name: "", type: "" },
    sites: [],
    activeSiteId: "",
    users: [{ id: userId, name, email, password: "", access: "owner" }],
  };
}

type Screen = "business" | "team" | "constraints" | "insights" | "schedule";

function todayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Locks have no control in the UI any more, so an older save must not keep invisible ones. */
function withoutLocks(state: RotaState): RotaState {
  const sched = Object.fromEntries(Object.entries(state.sched).map(([week, schedule]) => [week, { ...schedule, locked: [] }]));
  return { ...state, sched };
}

/**
 * The demo signs in as the owner only, so accounts added by an older save are dropped.
 * Approved messages are no longer kept either; the availability grid they wrote stays.
 */
function cleanSave(workspace: Workspace): Workspace {
  return {
    ...workspace,
    users: workspace.users.filter((item) => item.access === "owner"),
    sites: workspace.sites.map(({ state, ...site }) => {
      const { notes: _notes, ...rest } = state;
      return { ...site, state: rest };
    }),
  };
}

function loadWorkspace(): { workspace: Workspace; lang: Lang } {
  const saved = readWorkspaceSave(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
  if (saved) return { ...saved, workspace: cleanSave(saved.workspace) };
  const legacy = readDemoSave(window.localStorage.getItem(DEMO_STORAGE_KEY));
  if (legacy) return { workspace: cleanSave(sentinelWorkspace(legacy.state.week, withoutLocks(legacy.state))), lang: legacy.lang };
  return { workspace: sentinelWorkspace(sundayOnOrBefore(todayIso())), lang: "he" };
}

function useHistory(initial: RotaState) {
  const [history, setHistory] = useState<History>({ present: initial, past: [], future: [] });
  const update = useCallback((produce: (state: RotaState) => RotaState) => {
    setHistory((current) => commit(current, produce(current.present)));
  }, []);
  const undoHistory = useCallback(() => setHistory((current) => undo(current)), []);
  const redoHistory = useCallback(() => setHistory((current) => redo(current)), []);
  return {
    state: history.present,
    setHistory,
    update,
    undoHistory,
    redoHistory,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}

export function ScheduleApp() {
  const [workspace, setWorkspace] = useState<Workspace>(() => sentinelWorkspace(SENTINEL_FALLBACK_WEEK));
  const { state, setHistory, update, undoHistory, redoHistory, canUndo, canRedo } = useHistory(activeSite(workspace).state);
  const [lang, setLang] = useState<Lang>("he");
  const [theme, setTheme] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const remote = remoteConfigured();
  const tokenRef = useRef<string | null>(null);
  const savedRef = useRef("");
  const [selection, setSelection] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>("schedule");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nowHours, setNowHours] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState(SENTINEL_FALLBACK_WEEK);
  const aiEnabled = useAiEnabled();
  const t = copy[lang];

  const live = useMemo(() => withSiteState(workspace, workspace.activeSiteId, state), [workspace, state]);
  const user = live.users.find((item) => item.id === userId) ?? null;
  const actor = user ? actorFor(user) : VIEWER;
  const writer = Boolean(user && hasWrite(user));
  const owner = Boolean(user && isOwner(user));

  async function adopt(token: string, signedInId: string, email: string) {
    tokenRef.current = token;
    const response = await fetch("/api/workspace", { headers: { authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      setUserId(null);
      setHydrated(true);
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setRemoteError(body?.error === "db_unconfigured" ? "db" : "load");
      setUserId(signedInId);
      setHydrated(true);
      return;
    }
    const body = (await response.json()) as { workspace: Workspace | null };
    const next = body.workspace ?? blankWorkspace(signedInId, email);
    setWorkspace(next);
    if (next.sites.length > 0) setHistory({ present: activeSite(next).state, past: [], future: [] });
    setUserId(signedInId);
    savedRef.current = JSON.stringify(persistable(next));
    setRemoteError(null);
    setHydrated(true);
  }

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark" || (savedTheme === null && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setTheme("dark");
    }
    setCurrentWeek(sundayOnOrBefore(todayIso()));
    if (!remote) {
      const loaded = loadWorkspace();
      setWorkspace(loaded.workspace);
      setHistory({ present: activeSite(loaded.workspace).state, past: [], future: [] });
      setLang(loaded.lang);
      const session = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (session && loaded.workspace.users.some((item) => item.id === session)) setUserId(session);
      setHydrated(true);
      return;
    }
    const supabase = browserClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      tokenRef.current = session?.access_token ?? null;
      if (event !== "INITIAL_SESSION") return;
      if (!session) {
        setHydrated(true);
        return;
      }
      void adopt(session.access_token, session.user.id, session.user.email ?? "");
    });
    return () => data.subscription.unsubscribe();
  }, [remote, setHistory]);

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    if (!remote) {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, writeWorkspaceSave(live, lang));
      return;
    }
    if (!user || !writer || live.sites.length === 0) return;
    const payload = persistable(live);
    const json = JSON.stringify(payload);
    if (json === savedRef.current) return;
    const token = tokenRef.current;
    if (!token) return;
    const handle = window.setTimeout(() => {
      void fetch("/api/workspace", {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: json,
      }).then((response) => {
        if (response.ok) {
          savedRef.current = json;
          setSaveNote(null);
          return;
        }
        setSaveNote(response.status === 503 ? "db" : "save");
      });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [hydrated, live, lang, remote, user, writer]);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(THEME_KEY, theme);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
    return () => cancelAnimationFrame(frame);
  }, [hydrated, theme]);

  useEffect(() => {
    setNowHours(hoursSinceWeek(state.week, new Date()));
  }, [state.week]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
      if (event.key === "Escape") {
        setSelection(null);
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      setSelection(null);
      if (event.shiftKey) redoHistory();
      else undoHistory();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [redoHistory, undoHistory]);

  function change(produce: (current: RotaState) => RotaState) {
    setSelection(null);
    update(produce);
  }

  /** Workspace edits are not part of undo. Switching or replacing the active site starts a fresh history. */
  function changeWorkspace(produce: (current: Workspace) => Workspace) {
    const next = produce(live);
    if (next === live) return;
    setSelection(null);
    setWorkspace(next);
    const site = activeSite(next);
    if (site.id !== live.activeSiteId || site.state !== state) {
      setHistory({ present: site.state, past: [], future: [] });
      setSelectedId(null);
    }
  }

  function switchSite(siteId: string) {
    changeWorkspace((current) => {
      const next = selectSite(current, siteId);
      if (next === current) return current;
      const site = activeSite(next);
      return withSiteState(next, site.id, goToWeek(site.state, state.week));
    });
  }

  async function signIn(email: string, password: string): Promise<boolean> {
    if (!remote) {
      const found = authenticate(live, email, password);
      if (!found) return false;
      window.localStorage.setItem(SESSION_STORAGE_KEY, found.id);
      setUserId(found.id);
      setScreen("schedule");
      return true;
    }
    const { data, error } = await browserClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session || !data.user) return false;
    await adopt(data.session.access_token, data.user.id, data.user.email ?? email);
    setScreen("schedule");
    return true;
  }

  async function createAccount(email: string, password: string): Promise<"signed-in" | "confirm" | "failed"> {
    const { data, error } = await browserClient().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: email.trim().split("@")[0] ?? "" } },
    });
    if (error || !data.user) return "failed";
    if (!data.session) return "confirm";
    await adopt(data.session.access_token, data.user.id, data.user.email ?? email);
    setScreen("schedule");
    return "signed-in";
  }

  async function createOrg(name: string, type: string): Promise<boolean> {
    const token = tokenRef.current;
    if (!token) return false;
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (body?.error === "db_unconfigured") setRemoteError("db");
      return false;
    }
    const body = (await response.json()) as { workspace: Workspace };
    setWorkspace(body.workspace);
    if (body.workspace.sites[0]) setHistory({ present: body.workspace.sites[0].state, past: [], future: [] });
    savedRef.current = JSON.stringify(persistable(body.workspace));
    setRemoteError(null);
    setScreen("schedule");
    return true;
  }

  function signOut() {
    if (remote) void browserClient().auth.signOut();
    else window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setUserId(null);
    setSelection(null);
    setRemoteError(null);
  }

  function savePng(source: RotaState) {
    const data = weekExport(source, lang, live.org.name);
    if (!data) return;
    downloadWeekPng(
      data,
      { open: t.exportOpen, closed: t.exportClosed, covered: t.covered, overQuota: t.overQuota, legend: t.exportLegend },
      pngFileName(siteLabel(source.biz.name, lang), source.week),
    );
  }

  function publish() {
    if (!user) return;
    const next = publishWeek(state, freshStamp(user.name));
    if (next === state) return;
    change(() => next);
    savePng(next);
  }

  function exportPng() {
    savePng(state);
  }

  function exportJson() {
    const text = backupJson(state, { org: live.org.name, at: new Date().toISOString() });
    downloadBlob(new Blob([text], { type: "application/json" }), `rota-backup-${state.week}.json`);
  }

  const settings = (
    <SettingsMenu lang={lang} theme={theme} onLang={setLang} onTheme={setTheme} onSignOut={user ? signOut : undefined} />
  );

  if (!hydrated) return <div className="min-h-screen" />;

  if (remoteError === "db") {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 py-8">
        <p role="alert" className="text-sm leading-6 text-danger-text">
          {t.remoteDbMissing}
        </p>
        {settings}
      </div>
    );
  }

  if (!user) {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
        <LoginScreen
          lang={lang}
          orgName={remote ? "Rota" : live.org.name}
          demoAccounts={
            remote
              ? []
              : DEMO_USERS.filter((account) => live.users.some((item) => item.email === account.email)).map((account) => ({ ...account }))
          }
          demoPassword={DEMO_PASSWORD}
          toolbar={settings}
          onSignIn={signIn}
          onCreateAccount={remote ? createAccount : undefined}
        />
      </div>
    );
  }

  if (remote && live.sites.length === 0) {
    return (
      <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
        <CreateOrgScreen lang={lang} toolbar={settings} onCreate={createOrg} />
      </div>
    );
  }

  const schedule = state.sched[state.week];
  const published = schedule?.status === "published";
  const readOnly = published || !writer;
  const report = schedule ? analyze(state, state.week, lang) : EMPTY;
  const check = schedule ? publishCheck(state) : { ready: false, violations: 0, unfilled: 0 };
  const openSlots = slots(state, state.week);
  const selectedName = selection ? employeeName(state, parseAssignmentToken(selection)?.employeeId ?? "") : null;

  const status = !writer
    ? t.scheduleReadOnly
    : !schedule
      ? t.createBeforePublish
      : published
        ? report.unfilled.length > 0
          ? t.publishedOpen
          : t.publishedLock
        : check.ready
          ? t.allClear
          : publishBlocked(lang, check.violations, check.unfilled);

  const boardProps = {
    state,
    slots: openSlots,
    lang,
    published: readOnly,
    canCallOff: writer && published,
    nowHours,
    selectedToken: selection,
    onAdd: (slotKey: string, employeeId: string) => change((current) => addEmployee(current, slotKey, employeeId)),
    onRemove: (slotKey: string, employeeId: string) => change((current) => removeEmployee(current, slotKey, employeeId)),
    onMove: (fromKey: string, employeeId: string, toKey: string) =>
      change((current) => moveEmployee(current, fromKey, employeeId, toKey)),
    onSwap: (slotKey: string, employeeId: string, otherId: string) =>
      change((current) => swapInSlot(current, slotKey, employeeId, otherId)),
    onToggleSelect: (token: string) => setSelection((current) => (current === token ? null : token)),
    onCallOff: (slotKey: string, employeeId: string) =>
      change((current) =>
        reportCallOff(current, actor, {
          id: crypto.randomUUID(),
          slotKey,
          employeeId,
          at: new Date().toISOString(),
          nowHours: nowHours ?? Number.POSITIVE_INFINITY,
        }),
      ),
  };

  const tabs: { id: Screen; label: string }[] = [
    { id: "business", label: t.navBusiness },
    { id: "team", label: t.navTeam },
    { id: "constraints", label: t.navConstraints },
    { id: "insights", label: t.navInsights },
    { id: "schedule", label: t.navSchedule },
  ];
  const weekly = screen === "schedule" || screen === "constraints";

  return (
    <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur-xl">
        {saveNote ? (
          <p role="alert" className="mx-auto max-w-[1440px] px-4 pt-2 text-sm text-danger-text sm:px-6">
            {saveNote === "db" ? t.remoteDbMissing : t.saveFailed}
          </p>
        ) : null}
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BrandMark />
            <Wordmark />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only font-medium text-ink-soft sm:not-sr-only">{t.site}</span>
              <select
                data-testid="site-select"
                aria-label={t.site}
                className={`${button.quiet} max-w-36 px-3 sm:max-w-none`}
                value={live.activeSiteId}
                onChange={(event) => switchSite(event.target.value)}
              >
                {live.sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {siteLabel(site.state.biz.name, lang)}
                  </option>
                ))}
              </select>
            </label>
            {settings}
          </div>
        </div>
        <div className="mx-auto max-w-[1440px] px-4 pb-3 sm:px-6">
        <nav role="tablist" aria-label="Rota" className="grid grid-cols-5 gap-1 rounded-xl border border-line bg-track p-1 sm:inline-flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-testid={`nav-${tab.id}`}
              aria-selected={screen === tab.id}
              className={`min-h-9 rounded-lg px-1 py-2 text-center text-xs font-medium leading-4 sm:px-4 sm:text-sm sm:leading-5 ${
                screen === tab.id ? "bg-card font-semibold text-ink shadow-card" : "text-muted hover:bg-card/50 hover:text-ink"
              }`}
              onClick={() => {
                setSelection(null);
                setScreen(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        </div>
      </header>
      <main className={`mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 ${selection ? "pb-28" : ""}`}>
        {writer ? null : (
          <p
            data-testid="read-only-banner"
            className="flex items-start gap-3 rounded-xl border border-warn-line/40 bg-warn-softer px-4 py-3 text-sm leading-6 text-warn-text"
          >
            <EyeIcon />
            {t.readOnlyBanner}
          </p>
        )}
        {weekly ? (
          <section className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-line bg-card p-1 shadow-card">
              <button
                type="button"
                data-testid="prev-week"
                aria-label={t.previousWeek}
                className={stepButton}
                onClick={() => change((current) => goToWeek(current, addDays(current.week, -7)))}
              >
                ‹
              </button>
              <span data-testid="week-range" className="min-w-36 px-2 text-center text-sm font-semibold tabular-nums">
                {formatWeekRange(state.week, lang)}
              </span>
              <button
                type="button"
                data-testid="next-week"
                aria-label={t.nextWeek}
                className={stepButton}
                onClick={() => change((current) => goToWeek(current, addDays(current.week, 7)))}
              >
                ›
              </button>
            </div>
            {screen === "schedule" ? (
              <>
                <button
                  type="button"
                  data-testid="generate"
                  className={button.primary}
                  disabled={!writer || published}
                  onClick={() => change(generateWeek)}
                >
                  {schedule ? t.regenerate : t.generate}
                </button>
                <PublishButton
                  lang={lang}
                  canPublish={writer && Boolean(schedule) && !published && check.ready}
                  published={Boolean(published)}
                  canBackup={writer}
                  onPublish={publish}
                  onPng={exportPng}
                  onJson={exportJson}
                />
                <button type="button" data-testid="revert" className={button.quiet} disabled={!writer || !published} onClick={() => change(revertToDraft)}>
                  {t.revert}
                </button>
              </>
            ) : null}
            {writer ? (
              <>
                <button
                  type="button"
                  data-testid="undo"
                  className={button.quiet}
                  disabled={!canUndo}
                  onClick={() => {
                    setSelection(null);
                    undoHistory();
                  }}
                >
                  {t.undo}
                </button>
                <button
                  type="button"
                  data-testid="redo"
                  className={button.quiet}
                  disabled={!canRedo}
                  onClick={() => {
                    setSelection(null);
                    redoHistory();
                  }}
                >
                  {t.redo}
                </button>
              </>
            ) : null}
            {screen === "schedule" ? (
              <p data-testid="publish-status" aria-live="polite" className="text-sm leading-6 text-ink-soft sm:ms-2">
                {status}
              </p>
            ) : null}
          </section>
        ) : null}
        {screen === "schedule" ? (
          <div className="grid grid-cols-1 items-start gap-6 min-[1400px]:grid-cols-[minmax(0,1fr)_22rem]">
            <WeekBoard {...boardProps} />
            <div className="flex min-w-0 flex-col gap-4">
              <IssuesPanel
                state={state}
                report={report}
                lang={lang}
                hasSchedule={Boolean(schedule)}
                manager={writer}
                published={Boolean(published)}
                aiEnabled={aiEnabled}
                onApprove={(slot, index) => change((current) => approveProposal(current, slot, index))}
                onReplace={(slot, employeeId) =>
                  change((current) => approveReplacement(current, actor, slot.key, employeeId))
                }
                onEmergency={(slot, choice) => change((current) => approveEmergency(current, actor, slot.key, choice))}
              />
              <VersionsPanel
                state={state}
                lang={lang}
                canRestore={writer}
                onRestore={(versionId) => change((current) => restoreWeekVersion(current, actor, versionId))}
              />
            </div>
            {schedule ? (
              <div className="min-[1400px]:col-span-2">
                <WeekSummary state={state} report={report} lang={lang} />
              </div>
            ) : null}
          </div>
        ) : null}
        {screen === "team" ? (
          <TeamScreen
            state={state}
            lang={lang}
            canWrite={writer}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={(employeeId, patch) => change((current) => updateEmployee(current, actor, employeeId, patch))}
            onAdd={(name) => {
              const id = crypto.randomUUID();
              change((current) => addEmployeeRecord(current, actor, { id, name }));
              setSelectedId(id);
            }}
            onAgreement={(employeeId, dayIndex, shiftId, allowed) =>
              change((current) => setAgreement(current, actor, employeeId, dayIndex, shiftId, allowed))
            }
            onWholeAgreement={(employeeId, allowed) => change((current) => setWholeAgreement(current, actor, employeeId, allowed))}
            onDelete={(employeeId) => {
              change((current) => removeEmployeeRecord(current, actor, employeeId, currentWeek));
              setSelectedId(null);
            }}
            deletionBlock={(employeeId) => {
              const weeks = deletionBlockedBy(state, employeeId, currentWeek);
              return weeks.length > 0 ? deleteEmployeeBlocked(lang, weeks.map((week) => formatWeekRange(week, lang)).join(", ")) : null;
            }}
          />
        ) : null}
        {screen === "constraints" ? (
          <ConstraintsScreen
            state={state}
            lang={lang}
            canWrite={writer}
            aiEnabled={aiEnabled}
            onAvailability={(employeeId, dayIndex, shiftId, available) =>
              change((current) => setAvailability(current, actor, employeeId, dayIndex, shiftId, available))
            }
            onCopy={(employeeId) => change((current) => copyAvailability(current, actor, employeeId))}
            onApply={(raw, overrides) =>
              change((current) =>
                applyConstraintText(current, actor, raw, overrides),
              )
            }
          />
        ) : null}
        {screen === "business" ? (
          <BusinessScreen
            state={state}
            lang={lang}
            org={live.org}
            canEditOrg={owner}
            canWrite={writer}
            sites={live.sites.map((site) => ({ id: site.id, name: site.state.biz.name }))}
            activeSiteId={live.activeSiteId}
            siteNameAllowed={(name, siteId) => {
              const wanted = name.trim().toLowerCase();
              const shownTwice = live.sites.some(
                (site) => site.id !== siteId && siteLabel(site.state.biz.name, lang).trim().toLowerCase() === wanted,
              );
              return !shownTwice && renameSiteAllowed(live, siteId ?? "", name);
            }}
            onOrg={(patch) => changeWorkspace((current) => updateOrg(current, user, patch))}
            onSelectSite={switchSite}
            onAddSite={(name) =>
              changeWorkspace((current) => addSite(current, user, { id: crypto.randomUUID(), name, newId: () => crypto.randomUUID() }))
            }
            onRemoveSite={(siteId) => changeWorkspace((current) => removeSite(current, user, siteId))}
            onBusiness={(patch) => change((current) => updateBusiness(current, actor, patch))}
            onShift={(shiftId, patch) => change((current) => updateShift(current, actor, shiftId, patch))}
            onRequirement={(shiftId, dayIndex, count) => change((current) => setShiftRequirement(current, actor, shiftId, dayIndex, count))}
            onAddShift={(name) => change((current) => addShift(current, actor, { id: crypto.randomUUID(), name }))}
            onRemoveShift={(shiftId) => change((current) => removeShift(current, actor, shiftId))}
          />
        ) : null}
        {screen === "insights" ? <InsightsScreen state={state} lang={lang} /> : null}
      </main>
      {selectedName ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/90 px-4 py-3 shadow-pop backdrop-blur-xl sm:px-6">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
            <p className="text-sm font-medium">{selectionHint(lang, selectedName)}</p>
            <button type="button" className={button.quiet} onClick={() => setSelection(null)}>
              {t.cancelSelection}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

/** Publish, with the export formats in a menu on the same button. */
function PublishButton({
  lang,
  canPublish,
  published,
  canBackup,
  onPublish,
  onPng,
  onJson,
}: {
  lang: Lang;
  canPublish: boolean;
  published: boolean;
  canBackup: boolean;
  onPublish: () => void;
  onPng: () => void;
  onJson: () => void;
}) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const item =
    "block w-full rounded-lg px-3 py-2 text-start text-sm font-medium hover:bg-well disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent";
  return (
    <div ref={root} className="relative flex rounded-xl shadow-card">
      <button
        type="button"
        data-testid="publish"
        className={`${button.primary} rounded-e-none shadow-none`}
        disabled={!canPublish}
        onClick={onPublish}
      >
        {t.publish}
      </button>
      <button
        type="button"
        data-testid="export-menu"
        aria-label={t.exportMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${button.primary} rounded-s-none border-s border-on-brand/25 px-2.5 shadow-none`}
        onClick={() => setOpen((current) => !current)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor">
          <path d="M5.2 7.5a.75.75 0 0 1 1.06 0L10 11.2l3.74-3.7a.75.75 0 1 1 1.06 1.06l-4.27 4.24a.75.75 0 0 1-1.06 0L5.2 8.56a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute start-0 top-full z-30 mt-2 w-60 rounded-xl border border-line bg-card p-1.5 shadow-pop">
          <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.exportMenu}</p>
          <button
            type="button"
            role="menuitem"
            data-testid="export-png"
            className={item}
            disabled={!published}
            onClick={() => {
              setOpen(false);
              onPng();
            }}
          >
            PNG
            {published ? null : <span className="block text-xs font-normal text-subtle">{t.exportPublishedOnly}</span>}
          </button>
          {canBackup ? (
            <button
              type="button"
              role="menuitem"
              data-testid="export-json"
              className={item}
              onClick={() => {
                setOpen(false);
                onJson();
              }}
            >
              JSON
              <span className="block text-xs font-normal text-subtle">{t.exportJson}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const stepButton = "grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-ink-soft hover:bg-well hover:text-ink";

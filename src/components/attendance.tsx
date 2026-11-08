"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_WAIT_MS, TARGET_ACCURACY_METERS, clockProblem, deviceOffsetMinutes } from "../attendance/clock";
import { followFix, type Fix, type LockState } from "../attendance/locate";
import { formatDuration, formatLiveDuration, formatPunchStamp, formatWhen, pairPunches, zonedFields, type AttendancePunch, type AttendanceSession } from "../attendance/sessions";
import { localeOf, type Lang } from "../domain";
import { wallInstant } from "../domain/messages";
import { copy, type Copy } from "../i18n/copy";
import { button, card, cardHint, cardTitle, field, label, labelText, pill, select } from "./ui";

export type AttendanceSnapshot = {
  serverNow: string;
  timeZone: string;
  punches: AttendancePunch[];
};

export type AttendanceApi = {
  load: (siteId: string) => Promise<AttendanceSnapshot | string>;
  punch: (input: {
    siteId: string;
    kind: "in" | "out";
    deviceAt: string;
    deviceOffsetMinutes: number;
    latitude: number;
    longitude: number;
    accuracyMeters: number;
  }) => Promise<AttendanceSnapshot | string>;
  employee: (employeeId: string, signal?: AbortSignal) => Promise<AttendanceSnapshot | string>;
};

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function browserWatch(onFix: (fix: Fix) => void, onError: (kind: "denied" | "unavailable") => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError("unavailable");
    return () => {};
  }
  let stopped = false;
  let watchId = 0;
  let restarts = 0;
  const start = () => {
    watchId = navigator.geolocation.watchPosition(
      (position) =>
        onFix({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        if (stopped) return;
        if (error.code === 1) {
          onError("denied");
          return;
        }
        if (restarts >= 2) return;
        restarts += 1;
        navigator.geolocation.clearWatch(watchId);
        start();
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: GPS_WAIT_MS },
    );
  };
  start();
  return () => {
    stopped = true;
    navigator.geolocation.clearWatch(watchId);
  };
}

function radiusText(meters: number): string {
  return meters < 10 ? meters.toFixed(1) : String(Math.round(meters));
}

function problemText(code: string, t: Copy): string {
  if (code === "skew" || code === "clock") return t.attendanceClockSkew;
  if (code === "timezone") return t.attendanceClockZone;
  if (code === "accuracy") return t.attendanceWide;
  if (code === "denied") return t.attendanceDenied;
  if (code === "open") return t.attendanceAlreadyIn;
  if (code === "closed") return t.attendanceAlreadyOut;
  if (code === "forbidden") return t.attendanceForbidden;
  if (code === "location" || code === "unavailable") return t.attendanceNoFix;
  return t.saveFailed;
}

function dayKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function MapLink({ punch, label, added }: { punch: AttendancePunch; label: string; added: string }) {
  if (punch.latitude == null || punch.longitude == null || punch.accuracyMeters == null) {
    return <span className="text-muted">{added}</span>;
  }
  const href = `https://maps.google.com/maps?q=${punch.latitude},${punch.longitude}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-text underline-offset-2 hover:underline">
      {label}
      <span className="ms-1 text-muted">{Math.round(punch.accuracyMeters)} m</span>
    </a>
  );
}

function PunchTime({
  punch,
  timeZone,
  lang,
  original,
  onEdit,
  editLabel,
}: {
  punch: AttendancePunch;
  timeZone: string;
  lang: Lang;
  original: (time: string) => string;
  onEdit?: (punch: AttendancePunch) => void;
  editLabel: string;
}) {
  const when = formatWhen(punch.punchedAt, timeZone, lang);
  const first = punch.originalPunchedAt ? formatWhen(punch.originalPunchedAt, timeZone, lang).time : null;
  return (
    <span className="flex flex-col items-start gap-1">
      <span dir="ltr" className="tabular-nums">{when.time}</span>
      {first ? <span className="text-xs text-muted">{original(first)}</span> : null}
      {onEdit ? (
        <button type="button" data-testid={`attendance-edit-${punch.kind}`} className={button.small} onClick={() => onEdit(punch)}>
          {editLabel}
        </button>
      ) : null}
    </span>
  );
}

export function AttendanceTable({
  lang,
  timeZone,
  punches,
  recentDays,
  onEdit,
  onRemove,
}: {
  lang: Lang;
  timeZone: string;
  punches: AttendancePunch[];
  /** When set, only this many latest days are shown until the list is opened. */
  recentDays?: number;
  onEdit?: (punch: AttendancePunch) => void;
  /** Deletes the whole session: its clock-in and clock-out together. */
  onRemove?: (session: AttendanceSession) => void;
}) {
  const t = copy[lang];
  const [opened, setOpened] = useState(false);
  const [seen, setSeen] = useState(punches);
  if (seen !== punches) {
    setSeen(punches);
    setOpened(false);
  }
  const sessions = pairPunches(punches);
  if (sessions.length === 0) return <p className="text-sm text-muted">{t.attendanceEmpty}</p>;
  const days: string[] = [];
  for (const session of sessions) {
    const anchor = session.in ?? session.out;
    if (!anchor) continue;
    const key = dayKey(anchor.punchedAt, timeZone);
    if (!days.includes(key)) days.push(key);
  }
  const keep = recentDays !== undefined && !opened ? new Set(days.slice(0, recentDays)) : null;
  const shown = keep
    ? sessions.filter((session) => {
        const anchor = session.in ?? session.out;
        return anchor ? keep.has(dayKey(anchor.punchedAt, timeZone)) : false;
      })
    : sessions;
  const more = recentDays !== undefined && days.length > recentDays;
  return (
    <div>
    <div className="overflow-x-auto">
      <table data-testid="attendance-table" className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="pb-2 text-start font-medium">{t.attendanceDate}</th>
            <th className="pb-2 text-start font-medium">{t.attendanceInAt}</th>
            <th className="pb-2 text-start font-medium">{t.attendanceOutAt}</th>
            <th className="pb-2 text-start font-medium">{t.attendanceDuration}</th>
            <th className="pb-2 text-start font-medium">{t.attendancePlace}</th>
            {onRemove ? <th className="pb-2 text-start font-medium"><span className="sr-only">{t.attendanceRemove}</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {shown.map((session) => {
            const anchor = session.in ?? session.out;
            if (!anchor) return null;
            const when = formatWhen(anchor.punchedAt, timeZone, lang);
            return (
              <tr key={anchor.id} className="border-t border-line">
                <td className="py-2 pe-3 whitespace-nowrap">{when.date}</td>
                {/* The time is isolated. Direction on the cell itself pushes it into the duration column. */}
                <td className="py-2 pe-3 text-start align-top">
                  {session.in ? (
                    <PunchTime punch={session.in} timeZone={timeZone} lang={lang} original={t.attendanceOriginal} onEdit={onEdit} editLabel={t.attendanceEditTime} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pe-3 text-start align-top">
                  {session.out ? (
                    <PunchTime punch={session.out} timeZone={timeZone} lang={lang} original={t.attendanceOriginal} onEdit={onEdit} editLabel={t.attendanceEditTime} />
                  ) : (
                    t.attendanceOpen
                  )}
                </td>
                <td className="py-2 pe-3 whitespace-nowrap text-start">{session.in && session.out ? formatDuration(session.in.punchedAt, session.out.punchedAt, lang) : "—"}</td>
                <td className="py-2">
                  <span className="flex flex-col gap-1">
                    {session.in ? <MapLink punch={session.in} label={t.attendanceInAt} added={t.attendanceAdded} /> : null}
                    {session.out ? <MapLink punch={session.out} label={t.attendanceOutAt} added={t.attendanceAdded} /> : null}
                  </span>
                </td>
                {onRemove ? (
                  <td className="py-2 text-start align-top">
                    <button type="button" data-testid="attendance-remove-session" className={button.small} onClick={() => onRemove(session)}>
                      {t.attendanceRemove}
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {more ? (
      <button type="button" data-testid="attendance-show-more" className={`${button.small} mt-3`} onClick={() => setOpened((current) => !current)}>
        {opened ? t.attendanceShowLess : t.attendanceShowMore}
      </button>
    ) : null}
    </div>
  );
}

/** The employee's home: a live phone clock, checked against the server, then a punch with GPS. */
export function AttendanceScreen({
  lang,
  siteId,
  api,
  person,
}: {
  lang: Lang;
  siteId: string;
  api: AttendanceApi;
  person?: { name: string; role: string };
}) {
  const t = copy[lang];
  const now = useNow();
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [lock, setLock] = useState<LockState>({ status: "seeking", accuracy: null });
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const stopLock = useRef<(() => void) | null>(null);

  const beginLock = useCallback(() => {
    stopLock.current?.();
    setLock({ status: "seeking", accuracy: null });
    stopLock.current = followFix(browserWatch, setLock);
  }, []);

  useEffect(() => {
    beginLock();
    return () => stopLock.current?.();
  }, [beginLock]);

  useEffect(() => {
    let live = true;
    void api.load(siteId).then((result) => {
      if (!live) return;
      if (typeof result === "string") setNotice(problemText(result, t));
      else {
        setSnapshot(result);
        setReceivedAt(Date.now());
      }
    });
    return () => {
      live = false;
    };
  }, [api, siteId, t]);

  const serverNow =
    snapshot && receivedAt !== null ? new Date(new Date(snapshot.serverNow).getTime() + (now.getTime() - receivedAt)) : null;
  const skew = snapshot && serverNow ? clockProblem({ deviceNow: now, serverNow, timeZone: snapshot.timeZone }) : null;
  const newest = snapshot ? [...snapshot.punches].sort((left, right) => right.punchedAt.localeCompare(left.punchedAt))[0] : undefined;
  const open = newest?.kind === "in";
  const locale = localeOf(lang);
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now);
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now);

  const locked = lock.status === "locked" ? lock.fix : null;
  const canPunch = Boolean(snapshot) && !skew && !saving && locked !== null;
  const canRetry = !saving && (lock.status === "denied" || lock.status === "wide" || lock.status === "unavailable");

  async function punch() {
    if (!canPunch || !locked) return;
    setNotice(null);
    setSaved(false);
    setSaving(true);
    const deviceNow = new Date();
    const result = await api.punch({
      siteId,
      kind: open ? "out" : "in",
      deviceAt: deviceNow.toISOString(),
      deviceOffsetMinutes: deviceOffsetMinutes(deviceNow),
      latitude: locked.latitude,
      longitude: locked.longitude,
      accuracyMeters: locked.accuracy,
    });
    setSaving(false);
    if (typeof result === "string") {
      setNotice(problemText(result, t));
      return;
    }
    setSnapshot(result);
    setReceivedAt(Date.now());
    setSaved(true);
  }

  const nextOut = open;
  const buttonLabel = saving
    ? t.attendanceLoading
    : lock.status === "seeking"
      ? lock.accuracy === null
        ? t.attendanceAsking
        : t.attendanceLocatingMeters(radiusText(lock.accuracy))
      : lock.status === "denied"
        ? t.attendanceAllow
        : lock.status === "wide" || lock.status === "unavailable"
          ? t.attendanceRetry
          : nextOut
            ? t.attendanceReportOut
            : t.attendanceReportIn;
  const lockNotice =
    lock.status === "denied" ? t.attendanceDenied : lock.status === "wide" ? t.attendanceWide : lock.status === "unavailable" ? t.attendanceNoFix : null;

  return (
    <section data-testid="staff-attendance" className="flex flex-col gap-6">
      <div className={`${card} flex flex-col items-center gap-5 px-5 py-8 text-center`}>
        {person ? (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.attendanceHello(person.name)}</h2>
            {person.role ? <p className="mt-1 text-sm text-muted">{person.role}</p> : null}
          </div>
        ) : (
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{date}</p>
        )}
        <p data-testid="attendance-clock" className="sr-only">
          <span dir="ltr">{clock}</span>
        </p>
        <span className={`${pill} ${skew ? "bg-danger-soft text-danger-text" : "bg-ok-soft text-ok-text"}`}>
          {skew ? t.attendanceClockBad : snapshot ? t.attendanceClockOk : t.attendanceLoading}
        </span>
        {skew ? (
          <p role="alert" className="max-w-md text-sm leading-6 text-danger-text">
            {skew === "timezone" ? t.attendanceClockZone : t.attendanceClockSkew}
          </p>
        ) : null}
        <button
          type="button"
          data-testid={locked ? (nextOut ? "attendance-out" : "attendance-in") : "attendance-lock"}
          disabled={!canPunch && !canRetry}
          className={`punch-disc ${nextOut ? "punch-disc-out" : "punch-disc-in"} disabled:opacity-50`}
          onClick={() => {
            if (canRetry) beginLock();
            else void punch();
          }}
        >
          {buttonLabel}
        </button>
        {open && newest ? (
          <p data-testid="attendance-elapsed" className="text-sm font-medium tabular-nums text-ink">
            {formatLiveDuration(newest.punchedAt, now, lang)}
          </p>
        ) : null}
        {newest && snapshot ? (
          <p className="text-sm text-muted">
            {t.attendanceLast(newest.kind === "in" ? t.attendanceIn : t.attendanceOut, formatPunchStamp(newest.punchedAt, snapshot.timeZone, lang))}
          </p>
        ) : null}
        <div dir="ltr" className="flex items-center gap-3 text-base font-semibold text-ink">
          <span className={nextOut ? "text-muted" : "text-ink"}>{t.attendanceIn}</span>
          <span
            className={`relative h-7 w-12 rounded-full ${nextOut ? "bg-punch-out" : "bg-brand"}`}
            role="img"
            aria-label={nextOut ? t.attendanceOut : t.attendanceIn}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-on-brand shadow-card transition-[inset-inline-start] duration-200 ${nextOut ? "start-[1.35rem]" : "start-0.5"}`} />
          </span>
          <span className={nextOut ? "text-ink" : "text-muted"}>{t.attendanceOut}</span>
        </div>
        {lock.status === "seeking" && lock.accuracy !== null && lock.accuracy > TARGET_ACCURACY_METERS ? (
          <p className="max-w-md text-sm leading-6 text-muted">{t.attendanceCoarse(radiusText(lock.accuracy))}</p>
        ) : null}
        {locked ? <p className="text-sm font-medium text-ok-text">{t.attendanceLocked(radiusText(locked.accuracy))}</p> : null}
        {lockNotice && !notice ? (
          <p role="alert" className="max-w-md text-sm leading-6 text-danger-text">
            {lockNotice}
          </p>
        ) : null}
        {notice ? (
          <p role="alert" className="text-sm text-danger-text">
            {notice}
          </p>
        ) : null}
        {saved ? <p className="text-sm font-medium text-ok-text">{t.attendanceSaved}</p> : null}
      </div>
      <div className={card}>
        <h2 className={cardTitle}>{t.attendanceLog}</h2>
        <div className="mt-4">
          {snapshot ? <AttendanceTable lang={lang} timeZone={snapshot.timeZone} punches={snapshot.punches} /> : <p className="text-sm text-muted">{t.attendanceLoading}</p>}
        </div>
      </div>
    </section>
  );
}

export type AttendanceCorrection =
  | { action: "add"; employeeId: string; siteId: string; kind: "in" | "out"; at: string }
  | { action: "adjust"; employeeId: string; punchId: string; at: string }
  | { action: "remove"; employeeId: string; punchId: string; punchIdB?: string | null };

function correctionText(code: string, t: Copy): string {
  if (code === "future") return t.attendanceFuture;
  if (code === "old") return t.attendanceOld;
  if (code === "duplicate") return t.attendanceDuplicate;
  if (code === "open" || code === "closed") return t.attendanceSequence;
  if (code === "clock" || code === "kind") return t.attendanceBadTime;
  return problemText(code, t);
}

function nextKind(punches: AttendancePunch[]): "in" | "out" {
  const last = [...punches].sort((left, right) => left.punchedAt.localeCompare(right.punchedAt)).at(-1);
  return last?.kind === "in" ? "out" : "in";
}

/** The same log, on the employee card. A manager above this person can add a missed punch and correct a time. */
export function EmployeeAttendance({
  employeeId,
  lang,
  load,
  shared,
  canCorrect = false,
  sites = [],
  onCorrect,
}: {
  employeeId: string;
  lang: Lang;
  load: AttendanceApi["employee"];
  /** A roster already loaded for this screen. `null` is still loading. Omit it to load this person. */
  shared?: AttendanceSnapshot | null;
  canCorrect?: boolean;
  sites?: { id: string; name: string }[];
  onCorrect?: (input: AttendanceCorrection) => Promise<AttendanceSnapshot | string>;
}) {
  const t = copy[lang];
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot | null>(null);
  const [local, setLocal] = useState<AttendanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AttendancePunch | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [kind, setKind] = useState<"in" | "out">("in");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const view = local ?? (shared === undefined ? snapshot : shared);
  const zone = view?.timeZone || "Asia/Jerusalem";
  const chosenSite = sites.some((site) => site.id === siteId) ? siteId : (sites[0]?.id ?? "");

  useEffect(() => {
    setLocal(null);
    setEditing(null);
    setNotice(null);
    setDate("");
    setTime("");
    setSiteId(sites[0]?.id ?? "");
    if (shared !== undefined) return;
    const controller = new AbortController();
    let live = true;
    setSnapshot(null);
    setError(null);
    void load(employeeId, controller.signal).then((result) => {
      if (!live) return;
      if (typeof result === "string") setError(problemText(result, t));
      else {
        setSnapshot(result);
        const fields = zonedFields(result.serverNow, result.timeZone);
        setDate(fields.date);
        setTime(fields.time);
        setKind(nextKind(result.punches));
      }
    });
    return () => {
      live = false;
      controller.abort();
    };
    // `load` reads the current session token. Reloading follows the selected person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  useEffect(() => {
    if (!view || date) return;
    const fields = zonedFields(view.serverNow, view.timeZone);
    setDate(fields.date);
    setTime(fields.time);
    setKind(nextKind(view.punches));
  }, [view, date]);

  function beginEdit(punch: AttendancePunch) {
    const fields = zonedFields(punch.punchedAt, zone);
    setEditing(punch);
    setDate(fields.date);
    setTime(fields.time);
    setNotice(null);
  }

  function cancelEdit() {
    setEditing(null);
    setNotice(null);
    if (!view) return;
    const fields = zonedFields(view.serverNow, view.timeZone);
    setDate(fields.date);
    setTime(fields.time);
    setKind(nextKind(view.punches));
  }

  async function save(event: { preventDefault(): void }) {
    event.preventDefault();
    if (!onCorrect || !canCorrect) return;
    let at = "";
    try {
      at = wallInstant(date, time, zone);
    } catch {
      setNotice(t.attendanceBadTime);
      return;
    }
    if (!editing && !chosenSite) {
      setNotice(t.attendanceNoSite);
      return;
    }
    setSaving(true);
    setNotice(null);
    const result = editing
      ? await onCorrect({ action: "adjust", employeeId, punchId: editing.id, at })
      : await onCorrect({ action: "add", employeeId, siteId: chosenSite, kind, at });
    setSaving(false);
    if (typeof result === "string") {
      setNotice(correctionText(result, t));
      return;
    }
    setLocal(result);
    setEditing(null);
    const fields = zonedFields(result.serverNow, result.timeZone);
    setDate(fields.date);
    setTime(fields.time);
    setKind(nextKind(result.punches));
  }

  async function remove(session: AttendanceSession) {
    const punchId = session.in?.id ?? session.out?.id;
    if (!onCorrect || !punchId) return;
    if (!window.confirm(t.attendanceRemoveConfirm)) return;
    setSaving(true);
    setNotice(null);
    const result = await onCorrect({
      action: "remove",
      employeeId,
      punchId,
      punchIdB: session.in && session.out ? session.out.id : null,
    });
    setSaving(false);
    if (typeof result === "string") {
      setNotice(correctionText(result, t));
      return;
    }
    setLocal(result);
    if (editing && (editing.id === session.in?.id || editing.id === session.out?.id)) cancelEdit();
  }

  return (
    <section data-testid="attendance-log" className={card}>
      <h2 className={cardTitle}>{t.attendanceLog}</h2>
      {canCorrect ? <p className={cardHint}>{t.attendanceCorrectHint}</p> : null}
      {canCorrect && onCorrect ? (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
          <h3 className="text-sm font-medium text-ink sm:col-span-2">{editing ? t.attendanceEditTime : t.attendanceAddTitle}</h3>
          <label className={label}>
            <span className={labelText}>{t.attendanceDate}</span>
            <input type="date" required dir="ltr" className={field} value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className={label}>
            <span className={labelText}>{t.attendanceTime}</span>
            <input type="time" required dir="ltr" className={field} value={time} onChange={(event) => setTime(event.target.value)} />
          </label>
          {editing ? null : (
            <label className={label}>
              <span className={labelText}>{t.attendanceKind}</span>
              <select className={select} value={kind} onChange={(event) => setKind(event.target.value === "out" ? "out" : "in")}>
                <option value="in">{t.attendanceInAt}</option>
                <option value="out">{t.attendanceOutAt}</option>
              </select>
            </label>
          )}
          {editing || sites.length < 2 ? null : (
            <label className={label}>
              <span className={labelText}>{t.site}</span>
              <select className={select} value={chosenSite} onChange={(event) => setSiteId(event.target.value)}>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button type="submit" data-testid="attendance-save" className={button.primary} disabled={saving}>
              {editing ? t.attendanceSaveTime : t.attendanceAddSave}
            </button>
            {editing ? (
              <button type="button" className={button.quiet} onClick={cancelEdit}>
                {t.cancelEdit}
              </button>
            ) : null}
          </div>
          {notice ? (
            <p role="alert" className="text-sm text-danger-text sm:col-span-2">
              {notice}
            </p>
          ) : null}
        </form>
      ) : null}
      <div className="mt-4">
        {error ? (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        ) : view ? (
          <AttendanceTable
            lang={lang}
            timeZone={view.timeZone}
            punches={view.punches}
            recentDays={3}
            onEdit={canCorrect ? beginEdit : undefined}
            onRemove={canCorrect ? (punch) => void remove(punch) : undefined}
          />
        ) : (
          <p className="text-sm text-muted">{t.attendanceLoading}</p>
        )}
      </div>
    </section>
  );
}

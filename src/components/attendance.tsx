"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_WAIT_MS, TARGET_ACCURACY_METERS, clockProblem, deviceOffsetMinutes } from "../attendance/clock";
import { followFix, type Fix, type LockState } from "../attendance/locate";
import { formatDuration, formatLiveDuration, formatPunchStamp, formatWhen, pairPunches, type AttendancePunch } from "../attendance/sessions";
import type { Lang } from "../domain";
import { copy, type Copy } from "../i18n/copy";
import { button, card, cardHint, cardTitle, pill } from "./ui";

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

function MapLink({ punch, label }: { punch: AttendancePunch; label: string }) {
  const href = `https://maps.google.com/maps?q=${punch.latitude},${punch.longitude}`;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-text underline-offset-2 hover:underline">
      {label}
      <span className="ms-1 text-muted">{Math.round(punch.accuracyMeters)} m</span>
    </a>
  );
}

export function AttendanceTable({
  lang,
  timeZone,
  punches,
  recentDays,
}: {
  lang: Lang;
  timeZone: string;
  punches: AttendancePunch[];
  /** When set, only this many latest days are shown until the list is opened. */
  recentDays?: number;
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
                <td className="py-2 pe-3 whitespace-nowrap text-start">
                  {session.in ? <span dir="ltr" className="tabular-nums">{formatWhen(session.in.punchedAt, timeZone, lang).time}</span> : "—"}
                </td>
                <td className="py-2 pe-3 whitespace-nowrap text-start">
                  {session.out ? <span dir="ltr" className="tabular-nums">{formatWhen(session.out.punchedAt, timeZone, lang).time}</span> : t.attendanceOpen}
                </td>
                <td className="py-2 pe-3 whitespace-nowrap text-start">{session.in && session.out ? formatDuration(session.in.punchedAt, session.out.punchedAt, lang) : "—"}</td>
                <td className="py-2">
                  <span className="flex flex-col gap-1">
                    {session.in ? <MapLink punch={session.in} label={t.attendanceInAt} /> : null}
                    {session.out ? <MapLink punch={session.out} label={t.attendanceOutAt} /> : null}
                  </span>
                </td>
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
  const locale = lang === "he" ? "he-IL" : "en-GB";
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
        <p className={cardHint}>{t.attendanceLogHint}</p>
        <div className="mt-4">
          {snapshot ? <AttendanceTable lang={lang} timeZone={snapshot.timeZone} punches={snapshot.punches} /> : <p className="text-sm text-muted">{t.attendanceLoading}</p>}
        </div>
      </div>
    </section>
  );
}

/** The same log, on the employee card, for an owner or a shift manager. */
export function EmployeeAttendance({
  employeeId,
  lang,
  load,
  shared,
}: {
  employeeId: string;
  lang: Lang;
  load: AttendanceApi["employee"];
  /** A roster already loaded for this screen. `null` is still loading. Omit it to load this person. */
  shared?: AttendanceSnapshot | null;
}) {
  const t = copy[lang];
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (shared !== undefined) return;
    const controller = new AbortController();
    let live = true;
    setSnapshot(null);
    setError(null);
    void load(employeeId, controller.signal).then((result) => {
      if (!live) return;
      if (typeof result === "string") setError(problemText(result, t));
      else setSnapshot(result);
    });
    return () => {
      live = false;
      controller.abort();
    };
    // `load` reads the current session token. Reloading follows the selected person.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);
  return (
    <section data-testid="attendance-log" className={card}>
      <h2 className={cardTitle}>{t.attendanceLog}</h2>
      <p className={cardHint}>{t.attendanceLogHint}</p>
      <div className="mt-4">
        {error ? (
          <p role="alert" className="text-sm text-danger-text">
            {error}
          </p>
        ) : (shared ?? snapshot) ? (
          <AttendanceTable lang={lang} timeZone={(shared ?? snapshot)!.timeZone} punches={(shared ?? snapshot)!.punches} recentDays={3} />
        ) : (
          <p className="text-sm text-muted">{t.attendanceLoading}</p>
        )}
      </div>
    </section>
  );
}

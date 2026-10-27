"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GPS_WAIT_MS, TARGET_ACCURACY_METERS, clockProblem, deviceOffsetMinutes } from "../attendance/clock";
import { followFix, type Fix, type LockState } from "../attendance/locate";
import { formatDuration, formatWhen, pairPunches, type AttendancePunch } from "../attendance/sessions";
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
  employee: (employeeId: string) => Promise<AttendanceSnapshot | string>;
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
  if (code === "location" || code === "unavailable") return t.attendanceNoFix;
  return t.saveFailed;
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
}: {
  lang: Lang;
  timeZone: string;
  punches: AttendancePunch[];
}) {
  const t = copy[lang];
  const sessions = pairPunches(punches);
  if (sessions.length === 0) return <p className="text-sm text-muted">{t.attendanceEmpty}</p>;
  return (
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
          {sessions.map((session) => {
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
  );
}

/** The employee's home: a live phone clock, checked against the server, then a punch with GPS. */
export function AttendanceScreen({ lang, siteId, api }: { lang: Lang; siteId: string; api: AttendanceApi }) {
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
  const since = open && snapshot && newest ? formatWhen(newest.punchedAt, snapshot.timeZone, lang).time : null;
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
          : open
            ? t.attendanceOut
            : t.attendanceIn;
  const lockNotice =
    lock.status === "denied" ? t.attendanceDenied : lock.status === "wide" ? t.attendanceWide : lock.status === "unavailable" ? t.attendanceNoFix : null;

  return (
    <section data-testid="staff-attendance" className="flex flex-col gap-6">
      <div className={`${card} flex flex-col items-start gap-5`}>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{date}</p>
          <p data-testid="attendance-clock" className={`mt-3 text-6xl font-semibold tabular-nums tracking-[-0.04em] ${open ? "text-brand-text" : "text-ink"}`}>
            <span dir="ltr">{clock}</span>
          </p>
        </div>
        <span className={`${pill} ${skew ? "bg-danger-soft text-danger-text" : "bg-ok-soft text-ok-text"}`}>
          {skew ? t.attendanceClockBad : snapshot ? t.attendanceClockOk : t.attendanceLoading}
        </span>
        {skew ? (
          <p role="alert" className="max-w-md text-sm leading-6 text-danger-text">
            {skew === "timezone" ? t.attendanceClockZone : t.attendanceClockSkew}
          </p>
        ) : null}
        <p className="max-w-md text-sm leading-6 text-muted">{t.attendanceHint}</p>
        {since ? <p className="text-sm font-medium text-ink">{t.attendanceSince(since)}</p> : null}
        {lock.status === "seeking" && lock.accuracy !== null && lock.accuracy > TARGET_ACCURACY_METERS ? (
          <p className="max-w-md text-sm leading-6 text-muted">{t.attendanceCoarse(radiusText(lock.accuracy))}</p>
        ) : null}
        {locked ? <p className="text-sm font-medium text-ok-text">{t.attendanceLocked(radiusText(locked.accuracy))}</p> : null}
        <button
          type="button"
          data-testid={locked ? (open ? "attendance-out" : "attendance-in") : "attendance-lock"}
          className={`${button.primary} h-12 min-w-40 px-8 text-base`}
          disabled={!canPunch && !canRetry}
          onClick={() => {
            if (canRetry) beginLock();
            else void punch();
          }}
        >
          {buttonLabel}
        </button>
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
}: {
  employeeId: string;
  lang: Lang;
  load: AttendanceApi["employee"];
}) {
  const t = copy[lang];
  const [snapshot, setSnapshot] = useState<AttendanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setSnapshot(null);
    setError(null);
    void load(employeeId).then((result) => {
      if (!live) return;
      if (typeof result === "string") setError(problemText(result, t));
      else setSnapshot(result);
    });
    return () => {
      live = false;
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
        ) : snapshot ? (
          <AttendanceTable lang={lang} timeZone={snapshot.timeZone} punches={snapshot.punches} />
        ) : (
          <p className="text-sm text-muted">{t.attendanceLoading}</p>
        )}
      </div>
    </section>
  );
}

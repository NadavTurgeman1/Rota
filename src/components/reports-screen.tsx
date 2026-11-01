"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, heldRoles, roleNames, sundayOnOrBefore, type Lang, type RotaState } from "../domain";
import { zonedDate } from "../insights/report";
import { formatCalendarDate, shiftLabel } from "../schedule/display";
import { formatWhen } from "../attendance/sessions";
import { reportCopy } from "../reports/copy";
import {
  buildHours,
  buildPayroll,
  buildStandard,
  type HoursRow,
  type PayrollRow,
  type ReportPunch,
  type ReportSite,
  type StandardRow,
} from "../reports/build";
import { useMinute } from "./dashboard-screen";
import { button, field, label, labelText, pill, select } from "./ui";

type Kind = "hours" | "payroll" | "errors" | "standard";

const KINDS: Kind[] = ["hours", "payroll", "errors", "standard"];

type SiteInput = { id: string; name: string; state: RotaState };

type Log = { status: "loading" | "ready" | "missing"; timeZone: string; punches: ReportPunch[] | null };

export function ReportsScreen({
  lang,
  sites,
  timeZone,
  loadPunches,
}: {
  lang: Lang;
  sites: SiteInput[];
  timeZone: string;
  loadPunches: (siteId: string, from: string, to: string) => Promise<{ timeZone: string; punches: ReportPunch[] } | null>;
}) {
  const t = reportCopy[lang];
  const now = useMinute();
  const today = zonedDate(now, timeZone);
  const [kind, setKind] = useState<Kind>("hours");
  const [from, setFrom] = useState(() => sundayOnOrBefore(today));
  const [to, setTo] = useState(() => addDays(sundayOnOrBefore(today), 6));
  const [siteId, setSiteId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [logs, setLogs] = useState<Record<string, Log>>({});
  const loadRef = useRef(loadPunches);
  const sitesRef = useRef(sites);
  loadRef.current = loadPunches;
  sitesRef.current = sites;

  const range = orderedRange(from, to, today);
  const start = range.start;
  const end = range.end;
  const spanFrom = addDays(start, -1);
  const spanTo = addDays(end, 1);
  const sitesKey = sites.map((site) => site.id).join("|");
  const selected = sites.filter((site) => !siteId || site.id === siteId);

  useEffect(() => {
    let current = true;
    const wanted = sitesRef.current.filter((site) => !siteId || site.id === siteId);
    for (const site of wanted) {
      const key = `${site.id}|${spanFrom}|${spanTo}`;
      setLogs((prev) => (prev[key]?.status === "ready" ? prev : { ...prev, [key]: { status: "loading", timeZone, punches: prev[key]?.punches ?? null } }));
      void loadRef.current(site.id, spanFrom, spanTo).then((result) => {
        if (!current) return;
        setLogs((prev) => ({
          ...prev,
          [key]: result
            ? { status: "ready", timeZone: result.timeZone || timeZone, punches: result.punches }
            : { status: "missing", timeZone, punches: null },
        }));
      });
    }
    return () => {
      current = false;
    };
  }, [spanFrom, spanTo, siteId, sitesKey, timeZone]);

  const reportSites = useMemo<ReportSite[]>(() => {
    return selected.map((site) => {
      const log = logs[`${site.id}|${spanFrom}|${spanTo}`];
      return {
        id: site.id,
        name: site.name,
        timeZone: log?.timeZone || timeZone,
        state: site.state,
        punches: log?.status === "ready" ? log.punches : null,
      };
    });
  }, [selected, logs, spanFrom, spanTo, timeZone]);

  const pending = selected.some((site) => logs[`${site.id}|${spanFrom}|${spanTo}`]?.status !== "ready" && logs[`${site.id}|${spanFrom}|${spanTo}`]?.status !== "missing");
  const clocksMissing = !pending && selected.some((site) => logs[`${site.id}|${spanFrom}|${spanTo}`]?.status === "missing");
  const filters = { from: start, to: end, siteId: "", employeeId, role };
  const hours = useMemo(() => (pending ? [] : buildHours(reportSites, filters)), [pending, reportSites, filters]);
  const payroll = useMemo(
    () => (pending || kind === "hours" || kind === "standard" ? [] : buildPayroll(reportSites, filters, now)),
    [pending, kind, reportSites, filters, now],
  );
  const errors = useMemo(() => (kind === "errors" ? payroll.filter((row) => row.status === "exception") : []), [kind, payroll]);
  const standard = useMemo(
    () => (pending || kind !== "standard" ? [] : buildStandard(reportSites, filters, now)),
    [pending, kind, reportSites, filters, now],
  );

  const people = useMemo(() => {
    const rows = new Map<string, { id: string; name: string; role: string; secondaryRoles?: string[] }>();
    for (const site of selected) {
      for (const employee of site.state.emps) {
        if (employee.active === false) continue;
        if (role && !heldRoles(employee).some((item) => item.toLowerCase() === role.toLowerCase())) continue;
        rows.set(employee.id, employee);
      }
    }
    return [...rows.values()].sort((left, right) => left.name.localeCompare(right.name, lang === "he" ? "he" : "en"));
  }, [selected, role, lang]);
  const roles = useMemo(
    () => roleNames(selected.flatMap((site) => [...(site.state.biz.roles ?? []), ...site.state.biz.shifts.map((shift) => shift.role), ...site.state.emps.map((employee) => employee.role)])),
    [selected],
  );
  if (employeeId && !people.some((person) => person.id === employeeId)) setEmployeeId("");
  if (role && !roles.some((item) => item.toLowerCase() === role.toLowerCase())) setRole("");

  const table = tableFor(kind, hours, kind === "errors" ? errors : payroll, standard, lang, timeZone);
  const shown = pending ? [] : table.rows;

  return (
    <div data-testid="reports-screen" className="flex flex-col gap-6">
      <p className="max-w-3xl text-sm leading-6 text-muted">{t.hint}</p>
      <div role="tablist" aria-label={t.kind.hours} className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1 shadow-card">
        {KINDS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={kind === item}
            data-testid={`report-${item}`}
            className={`h-9 rounded-lg px-3 text-sm focus-visible:ring-2 focus-visible:ring-focus ${
              kind === item ? "bg-brand font-medium text-on-brand" : "text-muted hover:bg-well hover:text-ink"
            }`}
            onClick={() => setKind(item)}
          >
            {t.kind[item]}
          </button>
        ))}
      </div>
      <p className="max-w-3xl text-sm leading-6 text-muted">{t.kindHint[kind]}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className={label}>
          <span className={labelText}>{t.from}</span>
          <input type="date" className={field} dir="ltr" value={from} data-testid="report-from" onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className={label}>
          <span className={labelText}>{t.to}</span>
          <input type="date" className={field} dir="ltr" value={to} data-testid="report-to" onChange={(event) => setTo(event.target.value)} />
        </label>
        <label className={label}>
          <span className={labelText}>{t.site}</span>
          <select className={select} value={siteId} data-testid="report-site" onChange={(event) => setSiteId(event.target.value)}>
            <option value="">{t.allSites}</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          <span className={labelText}>{t.employee}</span>
          <select className={select} value={employeeId} data-testid="report-employee" onChange={(event) => setEmployeeId(event.target.value)}>
            <option value="">{t.allEmployees}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          <span className={labelText}>{t.role}</span>
          <select className={select} value={role} data-testid="report-role" onChange={(event) => setRole(event.target.value)}>
            <option value="">{t.allRoles}</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
      {pending ? <p className="text-sm text-muted">{t.loading}</p> : null}
      {clocksMissing ? <p className="text-sm text-muted">{t.missing}</p> : null}
      {kind === "standard" ? <p className="text-sm leading-6 text-muted">{t.scheduleBasis}</p> : null}
      {kind === "standard" && employeeId ? <p className="text-sm leading-6 text-muted">{t.employeeScope}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-muted" dir="ltr">
          {formatCalendarDate(start)} – {formatCalendarDate(end)}
        </p>
        <button
          type="button"
          className={button.quiet}
          data-testid="report-download"
          disabled={shown.length === 0}
          onClick={() => downloadCsv(`${kind}-${start}-${end}.csv`, table.columns, shown.map((row) => row.cells))}
        >
          {t.download}
        </button>
      </div>
      {shown.length === 0 && !pending ? <p className="text-sm text-muted">{t.empty}</p> : null}
      {shown.length > 0 ? (
        <div className="max-h-[32rem] overflow-auto rounded-xl border border-line bg-card shadow-card">
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <caption className="sr-only">{t.kind[kind]}</caption>
            <thead className="sticky top-0 bg-well">
              <tr>
                {table.columns.map((column) => (
                  <th key={column} scope="col" className="px-3 py-2 text-start text-xs font-medium text-ink-soft">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.key} className="border-t border-line">
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${index}`} className="px-3 py-2 text-ink">
                      {index === row.cells.length - 1 && row.tone ? <span className={`${pill} ${toneClass(row.tone)}`}>{cell}</span> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function orderedRange(from: string, to: string, today: string): { start: string; end: string } {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!day.test(from) || !day.test(to)) {
    const start = sundayOnOrBefore(today);
    return { start, end: addDays(start, 6) };
  }
  return from <= to ? { start: from, end: to } : { start: to, end: from };
}

function toneClass(tone: "ok" | "bad" | "warn"): string {
  if (tone === "ok") return "bg-ok-soft text-ok-text";
  if (tone === "bad") return "bg-danger-softer text-danger-text";
  return "bg-warn-soft text-warn-text";
}

function tableFor(
  kind: Kind,
  hours: HoursRow[],
  payroll: PayrollRow[],
  standard: StandardRow[],
  lang: Lang,
  timeZone: string,
): { columns: string[]; rows: { key: string; cells: string[]; tone?: "ok" | "bad" | "warn" }[] } {
  const t = reportCopy[lang];
  const clock = (iso: string | null) => (iso ? formatWhen(iso, timeZone, lang).time : "—");
  const date = (iso: string) => formatCalendarDate(iso);
  if (kind === "hours") {
    return {
      columns: [t.columns.employee, t.columns.role, t.columns.site, t.columns.date, t.columns.in, t.columns.out, t.columns.duration],
      rows: hours.map((row) => ({
        key: row.key,
        cells: [row.name, row.role || "—", row.siteName, date(row.date), clock(row.inAt), clock(row.outAt), row.minutes === null ? "—" : t.duration(row.minutes)],
      })),
    };
  }
  if (kind === "standard") {
    return {
      columns: [t.columns.date, t.columns.site, t.columns.shift, t.columns.role, t.columns.required, t.columns.assigned, t.columns.clocked, t.columns.result],
      rows: standard.map((row) => ({
        key: row.key,
        tone: row.gap < 0 ? "bad" : row.gap > 0 ? "warn" : "ok",
        cells: [
          date(row.date),
          row.siteName,
          shiftLabel(row.shiftName, lang),
          row.role || "—",
          String(row.required),
          String(row.assigned),
          row.clocked === null ? "—" : String(row.clocked),
          t.standardResult(row.gap, row.compared),
        ],
      })),
    };
  }
  return {
    columns: [t.columns.employee, t.columns.site, t.columns.date, t.columns.shift, t.columns.role, t.columns.standard, t.columns.in, t.columns.out, t.columns.result],
    rows: payroll.map((row) => ({
      key: row.key,
      tone: row.status === "standard" ? "ok" : row.status === "exception" ? "bad" : undefined,
      cells: [
        row.name,
        row.siteName,
        date(row.date),
        shiftLabel(row.shiftName, lang),
        row.role || "—",
        `${row.standardStart}–${row.standardEnd}`,
        clock(row.inAt),
        clock(row.outAt),
        resultText(row, lang),
      ],
    })),
  };
}

function resultText(row: PayrollRow, lang: Lang): string {
  const t = reportCopy[lang];
  if (row.status === "exception") {
    return row.issues.map((issue) => t.issue[issue](issue === "late" ? row.lateMinutes : row.earlyOutMinutes)).join(" · ");
  }
  if (row.status === "absence" && row.absence) return t.absence[row.absence];
  if (row.status === "standard") return t.status.standard;
  return t.status[row.status];
}

function downloadCsv(filename: string, columns: string[], rows: string[][]): void {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const body = [columns, ...rows].map((line) => line.map(escape).join(",")).join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

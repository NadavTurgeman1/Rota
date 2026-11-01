"use client";

import { useMemo, useState } from "react";
import type { LaborNote, Lang, RotaState } from "../domain";
import { formatCalendarDate, shiftLabel } from "../schedule/display";
import { screenCopy } from "../insights/copy";
import { buildInsights, type ClockPunch, type InsightReport, type InsightSpan } from "../insights/report";
import { useMinute } from "./dashboard-screen";

const SPANS: InsightSpan[] = ["day", "week", "month", "quarter"];
const SHOWN = 8;

type Lens = "shortages" | "occupancy" | "late" | "noshow" | "recurring" | "idle" | "patterns" | "hiring" | "burnout";

const LENSES: Lens[] = ["shortages", "occupancy", "late", "noshow", "recurring", "idle", "patterns", "hiring", "burnout"];

export function InsightsScreen({
  state,
  lang,
  timeZone,
  punches,
  clocks,
}: {
  state: RotaState;
  lang: Lang;
  timeZone: string;
  punches: ClockPunch[] | null;
  clocks: "loading" | "missing" | "ready";
}) {
  const t = screenCopy[lang];
  const now = useMinute();
  const [span, setSpan] = useState<InsightSpan>("week");
  const [openLabor, setOpenLabor] = useState<LaborNote["code"] | null>(null);
  const [lens, setLens] = useState<Lens>("shortages");
  const [lensSpan, setLensSpan] = useState(span);
  const report = useMemo(() => buildInsights(state, span, lang, timeZone, now, punches), [state, span, lang, timeZone, now, punches]);
  if (lensSpan !== span) {
    setLensSpan(span);
    setLens(bestLens(report, clocks));
    setOpenLabor(null);
  }
  const laborOpen = report.labor.find((group) => group.code === openLabor && group.count > 0) ?? null;

  return (
    <div data-testid="insights-screen" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="max-w-3xl text-sm leading-6 text-muted">{t.insightsHint}</p>
        <div role="tablist" aria-label={t.span.week} className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-line bg-card p-1 shadow-card">
          {SPANS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={span === item}
              data-testid={`insights-span-${item}`}
              className={`h-9 rounded-lg px-4 text-sm focus-visible:ring-2 focus-visible:ring-focus ${
                span === item ? "bg-brand font-medium text-on-brand" : "text-muted hover:bg-well hover:text-ink"
              }`}
              onClick={() => setSpan(item)}
            >
              {t.span[item]}
            </button>
          ))}
        </div>
        <p className="text-xs tabular-nums text-subtle" dir="ltr">
          {t.range(formatCalendarDate(report.from), formatCalendarDate(report.to))}
        </p>
        {clocks === "loading" ? <p className="text-sm text-muted">{t.loadingClocks}</p> : null}
        {clocks === "missing" ? <p className="text-sm text-muted">{t.clocksMissing}</p> : null}
      </div>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
        <h2 className="text-base font-semibold tracking-tight text-ink">{t.laborTitle}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{t.laborHint}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {report.labor.map((group, index) => {
            const open = laborOpen?.code === group.code;
            const clear = group.count === 0;
            return (
              <button
                key={group.code}
                type="button"
                data-testid={`labor-${group.code}`}
                aria-expanded={open}
                disabled={clear}
                style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
                className={`dash-rise flex min-h-24 flex-col items-start justify-between rounded-xl border px-3 py-3 text-start focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:opacity-100 ${
                  open ? "border-brand bg-brand-soft" : clear ? "border-ok-text bg-ok-soft" : "border-danger-line bg-danger-softer hover:border-danger-text"
                }`}
                onClick={() => setOpenLabor(open ? null : group.code)}
              >
                <span className={`text-3xl font-semibold tabular-nums leading-none ${open ? "text-brand-text" : clear ? "text-ok-text" : "text-danger-text"}`}>
                  {group.count}
                </span>
                <span className={`text-xs font-medium leading-4 ${open ? "text-brand-text" : clear ? "text-ok-text" : "text-danger-text"}`}>{t.laborCode[group.code]}</span>
              </button>
            );
          })}
        </div>
        {report.labor.every((group) => group.count === 0) ? <p className="mt-4 text-sm text-muted">{t.laborEmpty}</p> : null}
        {laborOpen ? (
          <ul data-testid="labor-detail" className="dash-rise mt-4 flex flex-col gap-2">
            {laborOpen.notes.map((note) => (
              <li key={note.key} className="rounded-lg bg-well px-3 py-2 text-sm leading-6 text-ink">
                {note.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-sm text-muted">{t.lensHint}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {LENSES.map((item, index) => {
            const value = lensValue(item, report, clocks);
            const health = lensHealth(item, report, clocks);
            const pressed = lens === item;
            const tone = health === "good" ? "text-ok-text" : health === "bad" ? "text-danger-text" : pressed ? "text-brand-text" : "text-ink";
            const face =
              health === "good"
                ? "border-ok-text bg-ok-soft"
                : health === "bad"
                  ? "border-danger-line bg-danger-softer"
                  : pressed
                    ? "border-brand bg-brand-soft"
                    : "border-line bg-card shadow-card hover:border-field-line";
            return (
              <button
                key={item}
                type="button"
                aria-pressed={pressed}
                style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
                className={`dash-rise flex min-h-20 flex-col items-start justify-between rounded-xl border px-3 py-3 text-start focus-visible:ring-2 focus-visible:ring-focus ${face} ${
                  pressed ? "ring-2 ring-brand ring-offset-2 ring-offset-page" : ""
                }`}
                onClick={() => setLens(item)}
              >
                <span className={`text-2xl font-semibold tabular-nums leading-none ${tone}`}>{value}</span>
                <span className={`text-xs font-medium leading-4 ${health === "wait" && !pressed ? "text-muted" : tone}`}>{lensTitle(item, t)}</span>
              </button>
            );
          })}
        </div>
        <div key={lens} className="dash-rise rounded-2xl border border-line bg-card p-4 shadow-card sm:p-5">
          <h2 className="text-base font-semibold tracking-tight text-ink">{lensTitle(lens, t)}</h2>
          <LensBody lens={lens} report={report} clocks={clocks} lang={lang} />
        </div>
      </section>
    </div>
  );
}

function bestLens(report: InsightReport, clocks: "loading" | "missing" | "ready"): Lens {
  const found = LENSES.find((item) => lensCount(item, report, clocks) > 0);
  return found ?? "shortages";
}

function lensCount(lens: Lens, report: InsightReport, clocks: "loading" | "missing" | "ready"): number {
  if (lens === "shortages") return report.shortages.length;
  if (lens === "occupancy") return report.secondaryFills.length;
  if (lens === "late") return clocks === "ready" ? report.late.length : 0;
  if (lens === "noshow") return clocks === "ready" ? report.noShows.length : 0;
  if (lens === "recurring") return report.recurring.length;
  if (lens === "idle") return clocks === "loading" ? 0 : report.idle.length;
  if (lens === "patterns") return clocks === "loading" ? 0 : report.patterns.length;
  if (lens === "hiring") return report.hiring.length;
  return report.burnout.length;
}

function lensHealth(lens: Lens, report: InsightReport, clocks: "loading" | "missing" | "ready"): "good" | "bad" | "wait" {
  if ((lens === "late" || lens === "noshow") && clocks !== "ready") return "wait";
  if ((lens === "idle" || lens === "patterns") && clocks === "loading") return "wait";
  return lensCount(lens, report, clocks) > 0 ? "bad" : "good";
}

function lensValue(lens: Lens, report: InsightReport, clocks: "loading" | "missing" | "ready"): string {
  const count = lensCount(lens, report, clocks);
  if ((lens === "late" || lens === "noshow") && clocks !== "ready") return "—";
  if ((lens === "idle" || lens === "patterns") && clocks === "loading") return "—";
  return String(count);
}

function lensTitle(lens: Lens, t: (typeof screenCopy)["he"]): string {
  if (lens === "shortages") return t.shortagesTitle;
  if (lens === "occupancy") return t.occupancyTitle;
  if (lens === "late") return t.lateTitle;
  if (lens === "noshow") return t.noShowTitle;
  if (lens === "recurring") return t.recurringTitle;
  if (lens === "idle") return t.idleTitle;
  if (lens === "patterns") return t.patternsTitle;
  if (lens === "hiring") return t.hiringTitle;
  return t.burnoutTitle;
}

function LensBody({
  lens,
  report,
  clocks,
  lang,
}: {
  lens: Lens;
  report: InsightReport;
  clocks: "loading" | "missing" | "ready";
  lang: Lang;
}) {
  const t = screenCopy[lang];
  if (lens === "late" && clocks !== "ready") return <p className="mt-3 text-sm text-muted">{clocks === "loading" ? t.loadingClocks : t.clocksMissing}</p>;
  if (lens === "noshow" && clocks !== "ready") return <p className="mt-3 text-sm text-muted">{clocks === "loading" ? t.loadingClocks : t.clocksMissing}</p>;
  if ((lens === "idle" || lens === "patterns") && clocks === "loading") return <p className="mt-3 text-sm text-muted">{t.loadingClocks}</p>;

  const rows = lensRows(lens, report, lang);
  if (rows.length === 0) return <p className="mt-3 text-sm text-muted">{lensEmpty(lens, t)}</p>;
  return (
    <ul className="mt-3 flex flex-col gap-2">
      {rows.slice(0, SHOWN).map((row) => (
        <li key={row.key} className="rounded-lg bg-well px-3 py-2 text-sm leading-6 text-ink">
          {row.text}
        </li>
      ))}
      {rows.length > SHOWN ? <li className="px-3 text-sm text-muted">{t.more(rows.length - SHOWN)}</li> : null}
    </ul>
  );
}

function lensEmpty(lens: Lens, t: (typeof screenCopy)["he"]): string {
  if (lens === "shortages") return t.shortagesEmpty;
  if (lens === "occupancy") return t.occupancyEmpty;
  if (lens === "late") return t.lateEmpty;
  if (lens === "noshow") return t.noShowEmpty;
  if (lens === "recurring") return t.recurringEmpty;
  if (lens === "idle") return t.idleEmpty;
  if (lens === "patterns") return t.patternsEmpty;
  if (lens === "hiring") return t.hiringEmpty;
  return t.burnoutEmpty;
}

function lensRows(lens: Lens, report: InsightReport, lang: Lang): { key: string; text: string }[] {
  const t = screenCopy[lang];
  if (lens === "shortages") {
    return report.shortages.map((row) => ({
      key: `${row.date}|${row.shiftId}`,
      text: t.shortageLine(shiftLabel(row.shiftName, lang), formatCalendarDate(row.date), row.filled, row.required),
    }));
  }
  if (lens === "occupancy") {
    return report.secondaryFills.map((row) => ({
      key: `${row.employeeId}|${row.date}|${row.shiftId}`,
      text: t.occupancyLine(row.name, shiftLabel(row.shiftName, lang), formatCalendarDate(row.date), row.role),
    }));
  }
  if (lens === "late") {
    return report.late.map((row) => ({
      key: `${row.employeeId}|${row.date}|${row.shiftId}`,
      text: t.lateLine(row.name, shiftLabel(row.shiftName, lang), formatCalendarDate(row.date), row.minutes),
    }));
  }
  if (lens === "noshow") {
    return report.noShows.map((row) => ({
      key: `${row.employeeId}|${row.date}|${row.shiftId}`,
      text: t.noShowLine(row.name, shiftLabel(row.shiftName, lang), formatCalendarDate(row.date)),
    }));
  }
  if (lens === "recurring") {
    return report.recurring.map((row) => ({
      key: row.shiftId,
      text: t.recurringLine(shiftLabel(row.shiftName, lang), row.role, row.times, row.missing),
    }));
  }
  if (lens === "idle") {
    return report.idle.map((row) => ({
      key: row.employeeId,
      text: row.last ? t.idleLine(row.name, row.days) : t.idleNever(row.name, row.days),
    }));
  }
  if (lens === "patterns") {
    return report.patterns.map((row) => ({
      key: `${row.employeeId}|${row.kind}`,
      text: t.patternLine(row.name, row.kind, row.count),
    }));
  }
  if (lens === "hiring") {
    return report.hiring.map((row) => ({
      key: row.shiftId,
      text: t.hiringLine(row.hire, row.role, shiftLabel(row.shiftName, lang), row.shortDays),
    }));
  }
  return report.burnout.map((row) => ({
    key: `${row.employeeId}|${row.code}`,
    text: `${t.burnoutAction[row.code]} — ${row.message}`,
  }));
}

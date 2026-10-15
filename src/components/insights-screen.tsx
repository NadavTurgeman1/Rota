import { useMemo } from "react";
import { dayName, type Lang, type RotaState } from "../domain";
import { anomalyText, balanceText, insightsCopy, tipText } from "../insights/copy";
import { sampleInsights, type AnomalyKind, type Risk } from "../insights/sample";
import { card, cardHint, cardTitle, pill, surface } from "./ui";

const RISK_TONE: Record<Risk, string> = {
  low: "bg-ok-soft text-ok-text",
  medium: "bg-warn-soft text-warn-text",
  high: "bg-danger-soft text-danger-text",
};

const LOAD_BAR: Record<Risk, string> = {
  low: "bg-ok-text",
  medium: "bg-warn-line",
  high: "bg-danger-text",
};

const ANOMALY_TONE: Record<AnomalyKind, string> = {
  nightStreak: "bg-danger-soft text-danger-text",
  overQuota: "bg-danger-soft text-danger-text",
  shortRest: "bg-warn-soft text-warn-text",
  lateSwaps: "bg-violet-soft text-violet-text",
  underUsed: "bg-ok-soft text-ok-text",
};

export function InsightsScreen({ state, lang }: { state: RotaState; lang: Lang }) {
  const t = insightsCopy[lang];
  const data = useMemo(() => sampleInsights(state), [state]);
  const scale = Math.max(...data.days.map((day) => Math.max(day.needed, day.available)), 1);

  const stats = [
    { id: "coverage", label: t.coverage, value: `${data.coverage}%`, tone: data.coverage >= 95 ? "text-ok-text" : "text-warn-text" },
    { id: "hours", label: t.hours, value: String(data.hours), tone: "text-ink" },
    { id: "doubles", label: t.doubles, value: String(data.doubles), tone: data.doubles > 2 ? "text-warn-text" : "text-ink" },
    { id: "risk", label: t.atRisk, value: String(data.atRisk), tone: data.atRisk > 0 ? "text-danger-text" : "text-ok-text" },
    {
      id: "balance",
      label: t.balance,
      value: balanceText(lang, data.balance),
      tone: data.balance < 0 ? "text-danger-text" : data.balance > 0 ? "text-ok-text" : "text-ink",
    },
  ];

  return (
    <div data-testid="insights-screen" className="flex flex-col gap-6">
      <section className={`${card} flex flex-wrap items-start justify-between gap-3`}>
        <div className="min-w-0">
          <h2 className={`${cardTitle} flex items-center gap-2 text-lg`}>
            <SparkIcon />
            {t.title}
          </h2>
          <p className={cardHint}>{t.hint}</p>
        </div>
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <span data-testid="insights-sample" className={`${pill} bg-violet-soft text-violet-text`}>
            {t.sample}
          </span>
          <p className="max-w-80 text-xs leading-5 text-muted sm:text-end">{t.sampleNote}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.id} data-testid={`insight-${stat.id}`} className={`${surface} min-w-0 p-4`}>
            <p className="text-sm text-muted">{stat.label}</p>
            <p className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${stat.tone}`}>{stat.value}</p>
            {stat.id === "coverage" ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, data.coverage)}%` }} />
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className={`${card} min-w-0`}>
          <h3 className={cardTitle}>{t.workloadTitle}</h3>
          <p className={cardHint}>{t.workloadHint}</p>
          {data.people.length === 0 ? <p className="mt-4 text-sm text-muted">{t.noPeople}</p> : null}
          <div className={`mt-4 overflow-x-auto ${data.people.length === 0 ? "hidden" : ""}`}>
            <table data-testid="insights-workload" className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs text-muted">
                  <th className="py-2 pe-3 text-start font-medium">{t.employee}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.shifts}</th>
                  <th className="w-1/3 px-3 py-2 text-start font-medium">{t.load}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.nights}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.doubles}</th>
                  <th className="ps-3 py-2 text-start font-medium">{t.risk}</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((person) => (
                  <tr key={person.id} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pe-3 font-medium text-ink">{person.name}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">
                      {person.shifts}/{person.quota}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
                          <div className={`h-full rounded-full ${LOAD_BAR[person.risk]}`} style={{ width: `${Math.min(100, (person.load / 150) * 100)}%` }} />
                        </div>
                        <span className="w-11 text-end text-xs tabular-nums text-ink-soft">{person.load}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">{person.nights}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-soft">{person.doubles}</td>
                    <td className="ps-3 py-2.5">
                      <span className={`${pill} ${RISK_TONE[person.risk]}`}>{t.riskLevel[person.risk]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${card} min-w-0`}>
          <h3 className={cardTitle}>{t.staffingTitle}</h3>
          <p className={cardHint}>{t.staffingHint}</p>
          <div className="mt-3 flex gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand" aria-hidden="true" />
              {t.available}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border-2 border-field-line" aria-hidden="true" />
              {t.needed}
            </span>
          </div>
          <ul data-testid="insights-staffing" className="mt-3 flex flex-col gap-2.5">
            {data.days.map((day) => {
              const gap = day.available - day.needed;
              return (
                <li key={day.day} className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                  <span className="font-medium text-ink-soft">{dayName(day.day, lang)}</span>
                  <div className="relative h-5 rounded-md bg-track" aria-hidden="true">
                    <div className="absolute inset-y-0 start-0 rounded-md bg-brand/80" style={{ width: `${(day.available / scale) * 100}%` }} />
                    <div className="absolute inset-y-0 start-0 rounded-md border-2 border-field-line" style={{ width: `${(day.needed / scale) * 100}%` }} />
                  </div>
                  <span
                    dir="ltr"
                    className={`text-center text-xs font-semibold tabular-nums ${gap < 0 ? "text-danger-text" : gap > 0 ? "text-ok-text" : "text-muted"}`}
                    aria-label={`${t.available} ${day.available}, ${t.needed} ${day.needed}`}
                  >
                    {gap > 0 ? `+${gap}` : gap}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={`${card} min-w-0`}>
          <h3 className={cardTitle}>{t.anomaliesTitle}</h3>
          {data.anomalies.length === 0 ? <p className="mt-4 text-sm text-muted">{t.noPeople}</p> : null}
          <ul data-testid="insights-anomalies" className="mt-4 flex flex-col gap-2">
            {data.anomalies.map((anomaly) => (
              <li key={anomaly.kind} className="flex items-start gap-3 rounded-xl border border-line bg-well/60 p-3 text-sm leading-6 text-ink">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${ANOMALY_TONE[anomaly.kind]}`} aria-hidden="true">
                  !
                </span>
                {anomalyText(lang, anomaly)}
              </li>
            ))}
          </ul>
        </section>
        <section className={`${card} min-w-0`}>
          <h3 className={cardTitle}>{t.tipsTitle}</h3>
          <p className={cardHint}>{t.tipsHint}</p>
          <ol data-testid="insights-tips" className="mt-4 flex flex-col gap-2">
            {data.tips.map((tip, index) => (
              <li key={tip.kind} className="flex items-start gap-3 rounded-xl border border-line bg-brand-soft/40 p-3 text-sm leading-6 text-ink">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand text-xs font-bold text-on-brand" aria-hidden="true">
                  {index + 1}
                </span>
                {tipText(lang, tip)}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 text-brand" fill="currentColor">
      <path d="M10 1.5l1.7 4.6a3 3 0 0 0 1.8 1.8L18 9.6l-4.5 1.7a3 3 0 0 0-1.8 1.8L10 17.6l-1.7-4.5a3 3 0 0 0-1.8-1.8L2 9.6l4.5-1.7a3 3 0 0 0 1.8-1.8L10 1.5Z" />
    </svg>
  );
}

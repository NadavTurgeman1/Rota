import type { Analysis, Lang, RotaState } from "../domain";
import { isRelief, peerLoad } from "../domain/relief";
import { copy } from "../i18n/copy";
import { pill, surface } from "./ui";

type Standing = "under" | "within" | "over" | "none";

const TONE: Record<Standing, string> = {
  under: "bg-warn-soft text-warn-text",
  within: "bg-ok-soft text-ok-text",
  over: "bg-danger-soft text-danger-text",
  none: "bg-well text-muted",
};

function standing(count: number, quota: number): Standing {
  if (!quota) return "none";
  return count < quota ? "under" : count > quota ? "over" : "within";
}

function hoursLabel(hours: number): string {
  return String(Math.round(hours * 10) / 10);
}

/** Shifts and hours each active person got this week, against their agreed count. */
export function WeekSummary({ state, report, lang }: { state: RotaState; report: Analysis; lang: Lang }) {
  const t = copy[lang];
  const label: Record<Standing, string> = { under: t.underQuota, within: t.withinQuota, over: t.overQuota, none: t.noQuota };
  const people = state.emps.filter((employee) => employee.active && !isRelief(employee, state.siteId));
  const rows = people.map((employee) => {
    const elsewhere = peerLoad(state, employee.id);
    const count = (report.counts[employee.id] ?? 0) + elsewhere.shifts;
    return { employee, count, hours: (report.hours[employee.id] ?? 0) + elsewhere.hours, standing: standing(count, employee.perWeek) };
  });
  const totalShifts = rows.reduce((sum, row) => sum + row.count, 0);
  const totalQuota = people.reduce((sum, employee) => sum + (employee.perWeek || 0), 0);
  const totalHours = rows.reduce((sum, row) => sum + row.hours, 0);

  return (
    <section data-testid="week-summary" className={`${surface} min-w-0 p-3 sm:p-4`}>
      <h2 className="text-sm font-semibold tracking-tight text-ink">{t.summaryTitle}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{t.summaryHint}</p>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.noEmployees}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[18rem] text-xs">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-1.5 pe-2 text-start font-medium">{t.summaryEmployee}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t.summaryShifts}</th>
                <th className="px-2 py-1.5 text-start font-medium">{t.summaryHours}</th>
                <th className="ps-2 py-1.5 text-start font-medium">{t.summaryStatus}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee.id} data-testid={`summary-${row.employee.id}`} className="border-b border-line">
                  <td className="py-1.5 pe-2 font-medium text-ink">{row.employee.name}</td>
                  <td className="px-2 py-1.5 tabular-nums text-ink-soft">
                    <span dir="ltr">
                      {row.employee.perWeek ? `${row.employee.perWeek} / ` : ""}
                      {row.count}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-ink-soft">{hoursLabel(row.hours)}</td>
                  <td className="ps-2 py-1.5">
                    <span className={`${pill} ${TONE[row.standing]}`}>{label[row.standing]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-ink">
                <td className="pt-1.5 pe-2">{t.summaryTotal}</td>
                <td className="px-2 pt-1.5 tabular-nums">
                  <span dir="ltr">
                    {totalQuota ? `${totalQuota} / ` : ""}
                    {totalShifts}
                  </span>
                </td>
                <td className="px-2 pt-1.5 tabular-nums">{hoursLabel(totalHours)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

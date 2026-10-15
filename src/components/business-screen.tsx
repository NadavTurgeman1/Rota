import { useEffect, useState } from "react";
import { dayName, type Lang, type RotaState } from "../domain";
import type { BusinessPatch, ShiftPatch } from "../business/edit";
import { confirmDeleteSite, copy } from "../i18n/copy";
import { orgTypeLabel, shiftLabel, siteLabel } from "../schedule/display";

import { button, card, cardHint, cardTitle, field, label, labelText } from "./ui";

const cell = field.replace("h-10", "h-9");

/** Commits on Enter or blur. `shown` may be a translated label; committing it unchanged is a no-op. */
function CommitInput({
  shown,
  type = "text",
  readOnly,
  label,
  testId,
  className = field,
  onCommit,
}: {
  shown: string;
  type?: "text" | "number" | "time";
  readOnly: boolean;
  label: string;
  testId?: string;
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  function commit() {
    if (readOnly || draft === shown) return;
    onCommit(draft);
    setDraft(shown);
  }
  return (
    <input
      type={type}
      min={type === "number" ? 0 : undefined}
      aria-label={label}
      data-testid={testId}
      value={draft}
      readOnly={readOnly}
      className={className}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
      onBlur={commit}
    />
  );
}

export interface SiteSummary {
  id: string;
  name: string;
}

export function BusinessScreen({
  state,
  lang,
  org,
  canEditOrg,
  canWrite,
  sites,
  activeSiteId,
  siteNameAllowed,
  onOrg,
  onSelectSite,
  onAddSite,
  onRemoveSite,
  onBusiness,
  onShift,
  onRequirement,
  onAddShift,
  onRemoveShift,
}: {
  state: RotaState;
  lang: Lang;
  org: { name: string; type: string };
  canEditOrg: boolean;
  canWrite: boolean;
  sites: SiteSummary[];
  activeSiteId: string;
  siteNameAllowed: (name: string, siteId?: string) => boolean;
  onOrg: (patch: { name?: string; type?: string }) => void;
  onSelectSite: (siteId: string) => void;
  onAddSite: (name: string) => void;
  onRemoveSite: (siteId: string) => void;
  onBusiness: (patch: BusinessPatch) => void;
  onShift: (shiftId: string, patch: ShiftPatch) => void;
  onRequirement: (shiftId: string, day: number, count: number) => void;
  onAddShift: (name: string) => void;
  onRemoveShift: (shiftId: string) => void;
}) {
  const t = copy[lang];
  const biz = state.biz;
  const readOnly = !canWrite;
  const [newSite, setNewSite] = useState("");
  const [siteError, setSiteError] = useState(false);
  const numbers: { key: "minRest" | "maxHours" | "maxShift" | "maxDayHours"; label: string }[] = [
    { key: "minRest", label: t.minRest },
    { key: "maxHours", label: t.maxHours },
    { key: "maxShift", label: t.maxShift },
    { key: "maxDayHours", label: t.maxDayHours },
  ];
  const activeName = sites.find((site) => site.id === activeSiteId)?.name ?? biz.name;

  return (
    <div data-testid="business-screen" className="flex flex-col gap-6">
      <section className={card}>
        <h2 className={cardTitle}>{t.businessTitle}</h2>
        {canEditOrg ? null : <p className={cardHint}>{t.orgReadOnly}</p>}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={label}>
            <span className={labelText}>{t.orgName}</span>
            <CommitInput shown={org.name} label={t.orgName} testId="org-name" readOnly={!canEditOrg} onCommit={(name) => onOrg({ name })} />
          </label>
          <label className={label}>
            <span className={labelText}>{t.bizType}</span>
            <CommitInput
              shown={orgTypeLabel(org.type, lang)}
              label={t.bizType}
              testId="org-type"
              readOnly={!canEditOrg}
              onCommit={(type) => onOrg({ type })}
            />
          </label>
        </div>
      </section>

      <section className={card}>
        <h2 className={cardTitle}>{t.sitesTitle}</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {sites.map((site) => (
            <li key={site.id}>
              <button
                type="button"
                data-testid={`site-${site.name}`}
                aria-pressed={site.id === activeSiteId}
                className={`inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-sm font-medium ${
                  site.id === activeSiteId
                    ? "border-brand bg-brand-soft text-brand-text"
                    : "border-line bg-card text-ink shadow-card hover:border-field-line hover:bg-well"
                }`}
                onClick={() => onSelectSite(site.id)}
              >
                {siteLabel(site.name, lang)}
              </button>
            </li>
          ))}
        </ul>
        {canWrite ? (
          <form
            className="mt-4 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newSite.trim();
              if (!name) return;
              if (!siteNameAllowed(name)) {
                setSiteError(true);
                return;
              }
              onAddSite(name);
              setNewSite("");
              setSiteError(false);
            }}
          >
            <input
              aria-label={t.newSiteName}
              data-testid="new-site-name"
              placeholder={t.newSiteName}
              value={newSite}
              onChange={(event) => {
                setNewSite(event.target.value);
                setSiteError(false);
              }}
              className={`${field} flex-1 sm:max-w-xs`}
            />
            <button type="submit" data-testid="add-site" className={button.primary} disabled={!newSite.trim()}>
              + {t.addSite}
            </button>
            {siteError ? (
              <span role="alert" className="text-sm font-medium text-danger-text">
                {t.siteNameTaken}
              </span>
            ) : null}
          </form>
        ) : null}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cardTitle}>
            {t.siteSettings} · {siteLabel(activeName, lang)}
          </h2>
          {canWrite ? (
            <button
              type="button"
              data-testid="delete-site"
              className={`${button.danger} ms-auto`}
              disabled={sites.length < 2}
              onClick={() => {
                if (window.confirm(confirmDeleteSite(lang, siteLabel(activeName, lang)))) onRemoveSite(activeSiteId);
              }}
            >
              {t.deleteSite}
            </button>
          ) : null}
        </div>
        {readOnly ? <p className={cardHint}>{t.businessReadOnly}</p> : null}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>
            <span className={labelText}>{t.siteName}</span>
            <CommitInput
              shown={siteLabel(biz.name, lang)}
              label={t.siteName}
              testId="site-name"
              readOnly={readOnly}
              onCommit={(name) => {
                if (siteNameAllowed(name, activeSiteId)) onBusiness({ name });
              }}
            />
          </label>
          {numbers.map(({ key, label }) => (
            <label key={key} className={label}>
              <span className={labelText}>{label}</span>
              <CommitInput
                type="number"
                shown={String(biz[key] ?? 0)}
                label={label}
                testId={`biz-${key}`}
                readOnly={readOnly}
                onCommit={(value) => onBusiness({ [key]: Number(value) })}
              />
            </label>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted">{t.lawHint}</p>
      </section>

      <section className={card}>
        <h2 className={cardTitle}>{t.shiftsTitle}</h2>
        <div className="-mx-1 mt-4 overflow-x-auto px-1">
          <table className="w-full min-w-[56rem] border-separate border-spacing-1 text-sm">
            <thead>
              <tr className="text-xs font-semibold text-muted">
                <th className="px-1 pb-1 text-start font-semibold">{t.shiftName}</th>
                <th className="px-1 pb-1 text-start font-semibold">{t.shiftStart}</th>
                <th className="px-1 pb-1 text-start font-semibold">{t.shiftEnd}</th>
                <th className="px-1 pb-1 text-start font-semibold">{t.requiredRole}</th>
                {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                  <th key={day} className="pb-1 font-semibold">
                    {dayName(day, lang)}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {biz.shifts.map((shift) => (
                <tr key={shift.id} data-testid={`shift-row-${shift.name}`}>
                  <td className="min-w-28">
                    <CommitInput
                      shown={shiftLabel(shift.name, lang)}
                      label={t.shiftName}
                      testId={`shift-name-${shift.name}`}
                      readOnly={readOnly}
                      className={`${cell} font-medium`}
                      onCommit={(name) => onShift(shift.id, { name })}
                    />
                  </td>
                  <td>
                    <CommitInput type="time" shown={shift.start} label={t.shiftStart} readOnly={readOnly} className={`${cell} tabular-nums`} onCommit={(start) => onShift(shift.id, { start })} />
                  </td>
                  <td>
                    <CommitInput type="time" shown={shift.end} label={t.shiftEnd} readOnly={readOnly} className={`${cell} tabular-nums`} onCommit={(end) => onShift(shift.id, { end })} />
                  </td>
                  <td className="min-w-28">
                    <CommitInput
                      shown={shift.role}
                      label={`${t.requiredRole} ${t.anyRole}`}
                      readOnly={readOnly}
                      className={cell}
                      onCommit={(role) => onShift(shift.id, { role })}
                    />
                  </td>
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <td key={day} className="w-16">
                      <CommitInput
                        type="number"
                        shown={String(Number(shift.req[day] || 0))}
                        label={`${shiftLabel(shift.name, lang)} ${dayName(day, lang)}`}
                        testId={`req-${shift.name}-${day}`}
                        readOnly={readOnly}
                        className={`${cell} text-center tabular-nums ${Number(shift.req[day] || 0) === 0 ? "text-subtle" : "font-semibold"}`}
                        onCommit={(value) => onRequirement(shift.id, day, Number(value))}
                      />
                    </td>
                  ))}
                  <td>
                    {canWrite ? (
                      <button
                        type="button"
                        data-testid={`delete-shift-${shift.name}`}
                        className={`${button.danger} h-9 px-3`}
                        disabled={biz.shifts.length < 2}
                        onClick={() => onRemoveShift(shift.id)}
                      >
                        {t.deleteShift}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">{t.staffingHint}</p>
        {canWrite ? (
          <button type="button" data-testid="add-shift" className={`${button.quiet} mt-4`} onClick={() => onAddShift(t.newShift)}>
            + {t.addShift}
          </button>
        ) : null}
      </section>
    </div>
  );
}

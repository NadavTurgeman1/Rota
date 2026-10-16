import { useEffect, useState } from "react";
import { dayName, type Lang, type RotaState } from "../domain";
import type { BusinessPatch, ShiftPatch } from "../business/edit";
import { confirmDeleteSite, copy } from "../i18n/copy";
import { orgTypeLabel, shiftLabel, siteLabel } from "../schedule/display";

import { accessLabel } from "./users-panel";
import { button, card, cardHint, cardTitle, field, label, labelText } from "./ui";

const cell = field.replace("h-10", "h-9");

function parseClock(value: string): [number, number] {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return [0, 0];
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return [0, 0];
  return [hour, minute];
}

function clockText(hour: number, minute: number): string {
  return `${String((hour + 24) % 24).padStart(2, "0")}:${String((minute + 60) % 60).padStart(2, "0")}`;
}

/** Hour arrows on the left, minute arrows on the right, inside the same box as a headcount field. */
function TimeStepper({
  value,
  label,
  readOnly,
  onCommit,
}: {
  value: string;
  label: string;
  readOnly: boolean;
  onCommit: (value: string) => void;
}) {
  const [hour, minute] = parseClock(value);
  function commit(nextHour: number, nextMinute: number) {
    onCommit(clockText(nextHour, nextMinute));
  }
  return (
    <div
      dir="ltr"
      lang="en"
      className={`inline-flex h-9 items-stretch rounded-xl border text-sm text-ink ${
        readOnly ? "border-line bg-well" : "border-field-line bg-card hover:border-muted"
      }`}
    >
      <ClockSpin label={label} value={hour} readOnly={readOnly} onStep={(step) => commit(hour + step, minute)} />
      <span className="flex items-center font-medium tabular-nums leading-none">{clockText(hour, minute)}</span>
      <ClockSpin label={`${label} :`} value={minute} readOnly={readOnly} onStep={(step) => commit(hour, minute + step)} />
    </div>
  );
}

function ClockSpin({
  value,
  label,
  readOnly,
  onStep,
}: {
  value: number;
  label: string;
  readOnly: boolean;
  onStep: (step: 1 | -1) => void;
}) {
  return (
    <input
      type="number"
      dir="ltr"
      lang="en"
      aria-label={label}
      value={value}
      disabled={readOnly}
      tabIndex={-1}
      className="clock-spin"
      onChange={(event) => {
        const next = Number(event.target.value);
        if (!Number.isFinite(next) || next === value) return;
        onStep(next > value ? 1 : -1);
      }}
    />
  );
}

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
      dir={type === "time" ? "ltr" : undefined}
      lang={type === "time" ? "en" : undefined}
      style={type === "time" ? { direction: "ltr" } : undefined}
      min={type === "number" ? 0 : undefined}
      aria-label={label}
      data-testid={testId}
      value={draft}
      readOnly={readOnly}
      className={className}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (type === "number" && !readOnly && next !== shown && next.trim() !== "" && Number.isFinite(Number(next))) onCommit(next);
      }}
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
  siteUsers,
  onInvite,
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
  siteUsers?: { id: string; name: string; email: string; access: "owner" | "write" | "read" }[];
  onInvite?: (input: { fullName: string; email: string; siteIds: string[] }) => Promise<boolean>;
}) {
  const t = copy[lang];
  const biz = state.biz;
  const readOnly = !canWrite;
  const [newSite, setNewSite] = useState("");
  const [siteError, setSiteError] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSites, setInviteSites] = useState<string[]>(activeSiteId ? [activeSiteId] : []);
  const [inviteNote, setInviteNote] = useState<"saved" | "failed" | null>(null);
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
        {canEditOrg ? (
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

      {onInvite ? (
        <section className={card}>
          <h2 className={cardTitle}>{t.usersTitle}</h2>
          <p className={cardHint}>{t.inviteHint}</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm">
            {(siteUsers ?? []).map((member) => (
              <li key={`${member.id}-${member.access}`} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-6">
                  <span className="font-medium">{member.name}</span>
                  <span dir="ltr" className="text-muted">
                    {member.email}
                  </span>
                </span>
                <span className="text-muted">{accessLabel(lang, member.access)}</span>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!onInvite) return;
              void (async () => {
                const ok = await onInvite({ fullName: inviteName, email: inviteEmail, siteIds: inviteSites });
                setInviteNote(ok ? "saved" : "failed");
                if (ok) {
                  setInviteName("");
                  setInviteEmail("");
                }
              })();
            }}
          >
            <label className={label}>
              <span className={labelText}>{t.fullName}</span>
              <input className={field} value={inviteName} onChange={(event) => setInviteName(event.target.value)} />
            </label>
            <label className={label}>
              <span className={labelText}>{t.email}</span>
              <input dir="ltr" type="email" className={field} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
            </label>
            <fieldset className={`${label} sm:col-span-2`}>
              <legend className={labelText}>{t.sitesTitle}</legend>
              <div className="mt-2 flex flex-col gap-2">
                {sites.map((site) => (
                  <label key={site.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={inviteSites.includes(site.id)}
                      onChange={() =>
                        setInviteSites((current) =>
                          current.includes(site.id) ? current.filter((id) => id !== site.id) : [...current, site.id],
                        )
                      }
                    />
                    <span>{siteLabel(site.name, lang)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex items-end">
              <button type="submit" className={`${button.primary} h-10`} disabled={!inviteName.trim() || !inviteEmail.trim() || inviteSites.length === 0}>
                {t.inviteUser}
              </button>
            </div>
            {inviteNote === "saved" ? <p className="text-sm text-muted sm:col-span-2">{t.inviteSaved}</p> : null}
            {inviteNote === "failed" ? (
              <p role="alert" className="text-sm text-danger-text sm:col-span-2">
                {t.saveFailed}
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      <section className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cardTitle}>
            {t.siteSettings} · {siteLabel(activeName, lang)}
          </h2>
          {canEditOrg ? (
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
                    <TimeStepper value={shift.start} label={t.shiftStart} readOnly={readOnly} onCommit={(start) => onShift(shift.id, { start })} />
                  </td>
                  <td>
                    <TimeStepper value={shift.end} label={t.shiftEnd} readOnly={readOnly} onCommit={(end) => onShift(shift.id, { end })} />
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

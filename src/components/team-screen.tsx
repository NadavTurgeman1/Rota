import { useEffect, useState } from "react";
import { dayName, type Lang, type RotaState } from "../domain";
import { isRelief } from "../domain/relief";
import { confirmDeleteEmployee, copy } from "../i18n/copy";
import { shiftLabel, siteLabel } from "../schedule/display";
import { agreementCell, availabilityCell, type EmployeePatch } from "../people/edit";

import { NameRail } from "./name-rail";
import { button, card, cardHint, cardTitle, field, label as labelClass, labelText, surface } from "./ui";

export function TeamScreen({
  state,
  lang,
  canWrite,
  selectedId,
  onSelect,
  onUpdate,
  onAdd,
  onAgreement,
  onPreference,
  onWholeAgreement,
  onDelete,
  deletionBlock,
  sites,
  siteId,
  assignedSiteIds,
  lockedSiteIds,
  onSites,
}: {
  state: RotaState;
  lang: Lang;
  canWrite: boolean;
  selectedId: string | null;
  onSelect: (employeeId: string) => void;
  onUpdate: (employeeId: string, patch: EmployeePatch) => void;
  onAdd: (name: string) => void;
  onAgreement: (employeeId: string, day: number, shiftId: string, allowed: boolean) => void;
  onPreference: (employeeId: string, shiftId: string, preferred: boolean) => void;
  onWholeAgreement: (employeeId: string, allowed: boolean) => void;
  onDelete: (employeeId: string) => void;
  /** Why the employee cannot be deleted right now, or `null`. */
  deletionBlock: (employeeId: string) => string | null;
  sites: { id: string; name: string }[];
  siteId: string;
  assignedSiteIds: string[];
  lockedSiteIds: string[];
  onSites: (employeeId: string, siteIds: string[], homeSiteId: string) => void;
}) {
  const t = copy[lang];
  const employee = state.emps.find((item) => item.id === selectedId) ?? null;
  const [newName, setNewName] = useState("");
  const railPerson = (item: (typeof state.emps)[number]) => ({
    id: item.id,
    name: item.name,
    hint: item.active ? item.role : t.inactive,
  });
  const mainRoster = state.emps.filter((item) => !isRelief(item, siteId));
  const reliefRoster = state.emps.filter((item) => isRelief(item, siteId));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <section className={`${surface} p-2`}>
          <NameRail
            lang={lang}
            testId="employee"
            selectedId={employee?.id ?? null}
            onSelect={onSelect}
            people={mainRoster.map(railPerson)}
            trailing={{ title: t.reliefRoster, people: reliefRoster.map(railPerson) }}
          />
          {canWrite ? (
          <form
            className="mt-2 flex gap-2 border-t border-line p-2 pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              const name = newName.trim();
              if (!name) return;
              onAdd(name);
              setNewName("");
            }}
          >
            <input
              aria-label={t.employeeName}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              className={field}
            />
            <button type="submit" data-testid="add-person" className={`${button.primary} h-10`} disabled={!newName.trim()}>
              {t.addPerson}
            </button>
          </form>
          ) : null}
        </section>
      {employee ? (
        <EmployeeCard
          key={employee.id}
          state={state}
          lang={lang}
          employeeId={employee.id}
          canEditAgreement={canWrite}
          onUpdate={onUpdate}
          onAgreement={onAgreement}
          onPreference={onPreference}
          onWholeAgreement={onWholeAgreement}
          onDelete={onDelete}
          deletionBlock={deletionBlock(employee.id)}
          sites={sites}
          assignedSiteIds={assignedSiteIds}
          homeSiteId={employee.homeSiteId ?? null}
          lockedSiteIds={lockedSiteIds}
          onSites={onSites}
        />
      ) : (
        <p className={`${card} text-sm text-muted`}>{t.pickEmployee}</p>
      )}
      </div>
    </div>
  );
}

function EmployeeCard({
  state,
  lang,
  employeeId,
  canEditAgreement,
  onUpdate,
  onAgreement,
  onPreference,
  onWholeAgreement,
  onDelete,
  deletionBlock,
  sites,
  assignedSiteIds,
  homeSiteId,
  lockedSiteIds,
  onSites,
}: {
  state: RotaState;
  lang: Lang;
  employeeId: string;
  canEditAgreement: boolean;
  onUpdate: (employeeId: string, patch: EmployeePatch) => void;
  onAgreement: (employeeId: string, day: number, shiftId: string, allowed: boolean) => void;
  onPreference: (employeeId: string, shiftId: string, preferred: boolean) => void;
  onWholeAgreement: (employeeId: string, allowed: boolean) => void;
  onDelete: (employeeId: string) => void;
  deletionBlock: string | null;
  sites: { id: string; name: string }[];
  assignedSiteIds: string[];
  homeSiteId: string | null;
  lockedSiteIds: string[];
  onSites: (employeeId: string, siteIds: string[], homeSiteId: string) => void;
}) {
  const t = copy[lang];
  const employee = state.emps.find((item) => item.id === employeeId)!;
  const [agreementLocked, setAgreementLocked] = useState(true);
  const agreementEditable = canEditAgreement && !agreementLocked;

  return (
    <div data-testid="employee-card" className="flex flex-col gap-6">
      <section className={card}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.employeeName}
            value={employee.name}
            readOnly={!canEditAgreement}
            onCommit={(name) => onUpdate(employeeId, { name })}
          />
          <TextField label={t.contact} value={employee.contact} onCommit={(contact) => onUpdate(employeeId, { contact })} readOnly={!canEditAgreement} />
          <TextField label={t.phone} value={employee.phone ?? ""} onCommit={(phone) => onUpdate(employeeId, { phone })} readOnly={!canEditAgreement} testId="employee-phone" />
          <TextField label={t.role} value={employee.role} onCommit={(role) => onUpdate(employeeId, { role })} readOnly={!canEditAgreement} />
          <TextField
            label={t.qualifications}
            value={employee.quals}
            onCommit={(quals) => onUpdate(employeeId, { quals })}
            readOnly={!canEditAgreement}
          />
          <NumberField
            label={t.quota}
            value={employee.perWeek}
            readOnly={!canEditAgreement}
            onCommit={(perWeek) => onUpdate(employeeId, { perWeek })}
          />
          <NumberField
            label={t.hourlyWage}
            value={employee.hourlyWage ?? 0}
            readOnly={!canEditAgreement}
            testId="hourly-wage"
            onCommit={(value) => onUpdate(employeeId, { hourlyWage: value })}
          />
          <NumberField
            label={t.hourCap}
            hint={`${t.hourCapHint} (${state.biz.maxHours})`}
            noneLabel={t.hourCapNone}
            value={employee.maxHours}
            readOnly={!canEditAgreement}
            onCommit={(maxHours) => onUpdate(employeeId, { maxHours })}
          />
        </div>
        <label className="mt-5 inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            data-testid="employee-active"
            className="h-4 w-4"
            checked={employee.active}
            disabled={!canEditAgreement}
            onChange={(event) => onUpdate(employeeId, { active: event.target.checked })}
          />
          {employee.active ? t.active : t.inactive}
        </label>
        {sites.length > 0 ? (
          <fieldset className="mt-5 border-t border-line pt-5">
            <legend className="text-sm font-medium text-ink">{t.employeeSites}</legend>
            <p className="mt-1 text-sm leading-6 text-muted">{t.employeeSitesHint}</p>
            <div className="mt-3 flex flex-col gap-2">
              {sites.map((site) => {
                const checked = assignedSiteIds.includes(site.id);
                const locked = checked && lockedSiteIds.includes(site.id);
                const primary = homeSiteId === site.id;
                const nextIds = checked ? assignedSiteIds.filter((id) => id !== site.id) : [...assignedSiteIds, site.id];
                const nextHome = nextIds.includes(homeSiteId ?? "") ? (homeSiteId ?? nextIds[0] ?? "") : (nextIds[0] ?? "");
                return (
                  <div key={site.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      data-testid={`employee-site-${site.id}`}
                      checked={checked}
                      disabled={!canEditAgreement || locked}
                      onChange={() => onSites(employeeId, nextIds, nextHome)}
                    />
                    <input
                      type="radio"
                      name={`employee-home-${employeeId}`}
                      data-testid={`employee-home-${site.id}`}
                      aria-label={t.primarySite}
                      checked={checked && primary}
                      disabled={!canEditAgreement || !checked}
                      onChange={() => onSites(employeeId, assignedSiteIds, site.id)}
                    />
                    <span>{siteLabel(site.name, lang)}</span>
                    {checked ? <span className="text-xs text-muted">{primary ? t.primarySite : t.reliefSite}</span> : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        {canEditAgreement ? (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <button
              type="button"
              data-testid="delete-employee"
              className={button.danger}
              disabled={Boolean(deletionBlock)}
              onClick={() => {
                if (window.confirm(confirmDeleteEmployee(lang, employee.name))) onDelete(employeeId);
              }}
            >
              {t.deleteEmployee}
            </button>
            {deletionBlock ? (
              <p data-testid="delete-blocked" className="text-sm leading-6 text-muted">
                {deletionBlock}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className={cardTitle}>{t.agreement}</h2>
            {canEditAgreement ? (
              <button
                type="button"
                data-testid="agreement-lock"
                aria-pressed={!agreementLocked}
                aria-label={agreementLocked ? t.unlockAgreement : t.lockAgreement}
                title={agreementLocked ? t.unlockAgreement : t.lockAgreement}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-ink hover:bg-well"
                onClick={() => setAgreementLocked((locked) => !locked)}
              >
                <LockIcon open={!agreementLocked} />
              </button>
            ) : null}
          </div>
          {canEditAgreement ? (
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="agreement-all"
                className={button.small}
                disabled={!agreementEditable}
                onClick={() => onWholeAgreement(employeeId, true)}
              >
                {t.selectAll}
              </button>
              <button
                type="button"
                data-testid="agreement-clear"
                className={button.small}
                disabled={!agreementEditable}
                onClick={() => onWholeAgreement(employeeId, false)}
              >
                {t.clearAll}
              </button>
            </div>
          ) : null}
        </div>
        {canEditAgreement ? null : <p className={cardHint}>{t.agreementReadOnly}</p>}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-ink">{t.preferenceTitle}</h3>
          <p className={cardHint}>{t.preferenceHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.biz.shifts.map((shift) => {
              const preferred = (employee.pref ?? []).includes(shift.id);
              return (
                <label
                  key={shift.id}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    preferred ? "border-brand bg-brand-soft text-brand-text" : "border-line bg-card"
                  } ${canEditAgreement ? "cursor-pointer" : "cursor-not-allowed"}`}
                >
                  <input
                    type="checkbox"
                    data-testid={`preference-${shift.name}`}
                    className="h-4 w-4"
                    checked={preferred}
                    disabled={!canEditAgreement}
                    onChange={(event) => onPreference(employeeId, shift.id, event.target.checked)}
                  />
                  {shiftLabel(shift.name, lang)}
                </label>
              );
            })}
          </div>
        </div>
        <WeekGrid
          state={state}
          lang={lang}
          employeeId={employeeId}
          mode="agreement"
          editable={agreementEditable}
          onToggle={(day, shiftId, checked) => onAgreement(employeeId, day, shiftId, checked)}
        />
      </section>
    </div>
  );
}

export function WeekGrid({
  state,
  lang,
  employeeId,
  mode,
  editable,
  onToggle,
}: {
  state: RotaState;
  lang: Lang;
  employeeId: string;
  mode: "agreement" | "availability";
  editable: boolean;
  onToggle: (day: number, shiftId: string, checked: boolean) => void;
}) {
  const t = copy[lang];
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-24" />
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <th key={day} scope="col" className="px-1 pb-1 text-center text-xs font-semibold text-muted">
                {dayName(day, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.biz.shifts.map((shift) => (
            <tr key={shift.id}>
              <th scope="row" className="pe-2 text-start text-xs font-semibold text-ink-soft">
                {shiftLabel(shift.name, lang)}
              </th>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const agreement = agreementCell(state, employeeId, day, shift.id);
                const availability = availabilityCell(state, employeeId, day, shift.id);
                const closed = agreement === "closed";
                const forbidden = mode === "availability" && availability === "forbidden";
                const checked = mode === "agreement" ? agreement === "allowed" : availability === "available";
                const disabled = !editable || closed || forbidden;
                const label = `${dayName(day, lang)} ${shiftLabel(shift.name, lang)}`;
                const tone = closed
                  ? "bg-well-strong"
                  : forbidden
                    ? "bg-well"
                    : mode === "availability" && availability === "unavailable"
                      ? "bg-danger-soft"
                      : checked
                        ? "bg-brand-soft"
                        : "bg-card";
                return (
                  <td key={day} className={`h-10 rounded-lg border border-line p-0 text-center ${tone}`}>
                    {closed || forbidden ? (
                      <span
                        className="block px-1 text-xs font-medium text-subtle"
                        title={closed ? t.siteClosed : t.agreementForbids}
                        aria-label={`${label}: ${closed ? t.siteClosed : t.agreementForbids}`}
                      >
                        {closed ? t.closed : "—"}
                      </span>
                    ) : (
                      <label
                        data-testid={`${mode}-cell-${day}-${shift.name}`}
                        className={`flex h-10 w-full items-center justify-center rounded-lg ${
                          disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-ink/5"
                        }`}
                      >
                        <input
                          type="checkbox"
                          data-testid={`${mode}-${day}-${shift.name}`}
                          aria-label={label}
                          className="h-[18px] w-[18px] disabled:cursor-not-allowed"
                          checked={checked}
                          disabled={disabled}
                          onChange={(event) => onToggle(day, shift.id, event.target.checked)}
                        />
                      </label>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LockIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      {open ? (
        <path
          fill="currentColor"
          d="M11.2 7H5.5V4.8a2.2 2.2 0 0 1 4.2-1l1.2-.7A3.5 3.5 0 0 0 4 4.8V7H3.5A1.5 1.5 0 0 0 2 8.5v5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 12.5 7h-1.3ZM8 9.2a1 1 0 0 1 .5 1.87V12.4H7.5v-1.33A1 1 0 0 1 8 9.2Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M5.5 7V4.8a2.5 2.5 0 0 1 5 0V7h2a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7h2Zm1.5 0h2V4.8a1 1 0 0 0-2 0V7Zm1 2.2a1 1 0 0 0-.5 1.87V12.4h1.5v-1.33A1 1 0 0 0 8 9.2Z"
        />
      )}
    </svg>
  );
}

function TextField({
  label,
  value,
  onCommit,
  readOnly = false,
  testId,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  readOnly?: boolean;
  testId?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className={labelClass}>
      <span className={labelText}>{label}</span>
      <input
        data-testid={testId}
        value={draft}
        readOnly={readOnly}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (readOnly || draft === value) return;
          onCommit(draft);
          if (!draft.trim()) setDraft(value);
        }}
        className={field}
      />
    </label>
  );
}

/** With `noneLabel`, `0` shows as an empty field with that word, and clearing the field stores `0`. */
function NumberField({
  label,
  hint,
  noneLabel,
  value,
  onCommit,
  readOnly = false,
  testId,
}: {
  label: string;
  hint?: string;
  noneLabel?: string;
  value: number;
  onCommit: (value: number) => void;
  readOnly?: boolean;
  testId?: string;
}) {
  const shown = noneLabel && value === 0 ? "" : String(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  return (
    <label className={labelClass}>
      <span className={labelText}>
        {label}
        {hint ? <span className="ms-2 text-xs font-normal text-muted">{hint}</span> : null}
      </span>
      <input
        type="number"
        min={0}
        data-testid={testId}
        value={draft}
        placeholder={noneLabel}
        readOnly={readOnly}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          if (readOnly) return;
          if (noneLabel && nextDraft.trim() === "") {
            if (value !== 0) onCommit(0);
            return;
          }
          const next = Number(nextDraft);
          if (nextDraft.trim() !== "" && Number.isFinite(next) && next !== value) onCommit(next);
        }}
        onBlur={() => {
          if (readOnly) return;
          const next = noneLabel && draft.trim() === "" ? 0 : Number(draft);
          if (draft.trim() === "" && !noneLabel) {
            setDraft(shown);
            return;
          }
          if (!Number.isFinite(next) || next === value) {
            setDraft(shown);
            return;
          }
          onCommit(next);
        }}
        className={field}
      />
    </label>
  );
}

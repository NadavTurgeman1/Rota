import { useEffect, useState } from "react";
import { dayName, heldRoles, shiftVisible, type Business, type Employee, type Lang, type RotaState } from "../domain";
import { employeeProfile } from "../domain/profile";
import { isRelief } from "../domain/relief";
import { confirmDeleteEmployee, copy } from "../i18n/copy";
import { columnIsToday, shiftLabel, siteLabel } from "../schedule/display";
import { absenceOnWeekDay } from "../domain/absence";
import { MANAGER, agreementCell, availabilityCell, updateEmployee, type EmployeePatch } from "../people/edit";
import { blockSplitOf, customFromSite } from "../people/blocks";
import { BlockNumberFields } from "./block-limit";
import { EmployeeAttendance, type AttendanceApi, type AttendanceSnapshot } from "./attendance";
import { EmployeeForms, type EmployeeFormsApi } from "./employee-forms";
import { DayDates } from "./day-dates";
import { NameRail } from "./name-rail";
import type { Capabilities } from "../domain";
import { EmployeeAuthority } from "./employee-authority";
import { CreatePerson, type NewPerson } from "./create-person";
import { isSchedulable, isSiteManager, withoutShiftCapabilities, capabilitiesOf, type ReportNode } from "../access/hierarchy";
import { RoleChoice } from "./business-screen";
import { button, card, cardHint, cardTitle, field, label as labelClass, labelText, select, surface } from "./ui";

export function TeamScreen({
  state,
  lang,
  canWrite,
  selectedId,
  onSelect,
  onUpdate,
  onCreate,
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
  loadAttendance,
  sharedAttendance,
  forms,
  editorId,
  editorCapabilities,
  owner,
  directory,
  onDraft,
}: {
  state: RotaState;
  lang: Lang;
  canWrite: boolean;
  selectedId: string | null;
  onSelect: (employeeId: string) => void;
  onUpdate: (employeeId: string, patch: EmployeePatch) => void;
  onCreate: (person: NewPerson) => void;
  onAgreement: (employeeId: string, day: number, shiftId: string, allowed: boolean) => void;
  onPreference: (employeeId: string, shiftId: string, preferred: boolean) => void;
  onWholeAgreement: (employeeId: string, allowed: boolean) => void;
  onDelete: (employeeId: string) => void;
  /** Why the employee cannot be deleted right now, or `null`. */
  deletionBlock: (employeeId: string) => string | null;
  sites: { id: string; name: string; biz?: Business }[];
  siteId: string;
  assignedSiteIds: string[];
  lockedSiteIds: string[];
  onSites: (employeeId: string, siteIds: string[], homeSiteId: string) => void;
  loadAttendance: AttendanceApi["employee"];
  /** Punches for the open site, loaded once. `null` while that request is in flight. */
  sharedAttendance?: (employeeId: string) => AttendanceSnapshot | null;
  forms: EmployeeFormsApi;
  editorId: string | null;
  editorCapabilities: Capabilities;
  owner: boolean;
  directory: (ReportNode & { name: string })[];
  onDraft?: (draft: { dirty: boolean; save: () => void; discard: () => void } | null) => void;
}) {
  const t = copy[lang];
  const [creating, setCreating] = useState(false);
  const hideSelf = editorId;
  const workers = state.emps.filter((item) => isSchedulable(item) && !isSiteManager(item) && !isRelief(item, siteId) && item.id !== hideSelf);
  const leads = state.emps.filter((item) => isSiteManager(item) && !isRelief(item, siteId) && item.id !== hideSelf);
  const visible = [...workers, ...leads];
  const employee = visible.find((item) => item.id === selectedId) ?? null;
  const railPerson = (item: (typeof state.emps)[number]) => ({
    id: item.id,
    name: item.name,
    hint: isSiteManager(item) ? (isSchedulable(item) ? t.personBoth : t.personLead) : item.active ? item.role : t.inactive,
  });
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <section className={`${surface} p-2`}>
          <NameRail
            lang={lang}
            testId="employee"
            selectedId={employee?.id ?? null}
            onSelect={onSelect}
            title={workers.length > 0 && leads.length > 0 ? t.staffGroup : undefined}
            people={workers.map(railPerson)}
            groups={leads.length > 0 ? [{ title: t.siteManagers, people: leads.map(railPerson) }] : []}
          />
          {canWrite ? (
            <button type="button" data-testid="add-person" className={`${button.quiet} m-2 mt-3 w-[calc(100%-1rem)]`} onClick={() => setCreating(true)}>
              {t.createPerson}
            </button>
          ) : null}
        </section>
      {creating && canWrite ? (
        <section className={card}>
          <CreatePerson
            lang={lang}
            sites={sites.map((site) => ({ id: site.id, name: site.name }))}
            siteId={siteId}
            editorCapabilities={editorCapabilities}
            owner={owner}
            onCancel={() => setCreating(false)}
            onCreate={(person) => {
              onCreate(person);
              setCreating(false);
            }}
          />
        </section>
      ) : employee ? (
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
          siteId={siteId}
          assignedSiteIds={assignedSiteIds}
          homeSiteId={employee.homeSiteId ?? null}
          lockedSiteIds={lockedSiteIds}
          onSites={onSites}
          loadAttendance={loadAttendance}
          sharedAttendance={sharedAttendance}
          forms={forms}
          editorId={editorId}
          editorCapabilities={editorCapabilities}
          owner={owner}
          directory={directory}
          onDraft={onDraft}
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
  siteId,
  assignedSiteIds,
  homeSiteId,
  lockedSiteIds,
  onSites,
  loadAttendance,
  sharedAttendance,
  forms,
  editorId,
  editorCapabilities,
  owner,
  directory,
  onDraft,
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
  sites: { id: string; name: string; biz?: Business }[];
  siteId: string;
  assignedSiteIds: string[];
  homeSiteId: string | null;
  lockedSiteIds: string[];
  onSites: (employeeId: string, siteIds: string[], homeSiteId: string) => void;
  loadAttendance: AttendanceApi["employee"];
  sharedAttendance?: (employeeId: string) => AttendanceSnapshot | null;
  forms: EmployeeFormsApi;
  editorId: string | null;
  editorCapabilities: Capabilities;
  owner: boolean;
  directory: (ReportNode & { name: string })[];
  onDraft?: (draft: { dirty: boolean; save: () => void; discard: () => void } | null) => void;
}) {
  const t = copy[lang];
  const employee = state.emps.find((item) => item.id === employeeId)!;
  const [agreementLocked, setAgreementLocked] = useState(true);
  const agreementEditable = canEditAgreement && !agreementLocked;
  const homeId = employee.homeSiteId || siteId;
  const homeSite = homeId === siteId ? { name: state.biz.name, biz: state.biz } : sites.find((site) => site.id === homeId);
  const blockHome = homeSite?.biz ? { biz: homeSite.biz, name: homeSite.name, away: homeId !== siteId } : null;

  return (
    <div data-testid="employee-card" className="flex flex-col gap-6">
      <section className={card}>
        <EmployeeDetails
          lang={lang}
          employee={employee}
          readOnly={!canEditAgreement}
          hourCapHint={`${t.hourCapHint} (${state.biz.maxHours})`}
          hourCapNone={t.hourCapNone}
          blockHome={blockHome}
          onUpdate={(patch) => onUpdate(employeeId, patch)}
          onDraft={onDraft}
          roles={state.biz.roles ?? []}
          siteId={siteId}
          people={directory}
          editorId={editorId}
          editorCapabilities={editorCapabilities}
          owner={owner}
        />
        {sites.length > 0 && employee.schedulable !== false ? (
          <div className="mt-6 border-t border-line pt-6">
            <h3 className="text-sm font-medium text-ink">{t.employeeSites}</h3>
            {(() => {
              const home = homeSiteId && assignedSiteIds.includes(homeSiteId) ? homeSiteId : (assignedSiteIds[0] ?? "");
              const others = sites.filter((site) => site.id !== home);
              return (
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    <span className={labelText}>{t.primarySiteTitle}</span>
                    <select
                      className={select}
                      data-testid="employee-home-site"
                      value={home}
                      disabled={!canEditAgreement}
                      onChange={(event) => {
                        const next = event.target.value;
                        onSites(employeeId, assignedSiteIds.includes(next) ? assignedSiteIds : [...assignedSiteIds, next], next);
                      }}
                    >
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {siteLabel(site.name, lang)}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs leading-5 text-muted">{t.primarySiteHint}</span>
                  </label>
                  <div className={labelClass}>
                    <span className={labelText}>{t.reliefSitesTitle}</span>
                    {others.length === 0 ? (
                      <span className="text-sm text-muted">{t.noReliefSites}</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {others.map((site) => {
                          const checked = assignedSiteIds.includes(site.id);
                          const locked = checked && lockedSiteIds.includes(site.id);
                          return (
                            <label key={site.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                data-testid={`employee-site-${site.id}`}
                                className="h-4 w-4"
                                checked={checked}
                                disabled={!canEditAgreement || locked}
                                onChange={() =>
                                  onSites(
                                    employeeId,
                                    checked ? assignedSiteIds.filter((id) => id !== site.id) : [...assignedSiteIds, site.id],
                                    home,
                                  )
                                }
                              />
                              <span>{siteLabel(site.name, lang)}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <span className="text-xs leading-5 text-muted">{t.reliefSitesHint}</span>
                  </div>
                </div>
              );
            })()}
            <p className="mt-3 text-xs leading-5 text-muted">{t.employeeSitesHint}</p>
          </div>
        ) : sites.length > 0 ? (
          <div className="mt-6 border-t border-line pt-6">
            <h3 className="text-sm font-medium text-ink">{t.managedSites}</h3>
            <div className="mt-3 flex flex-col gap-2">
              {sites.map((site) => {
                const checked = (employee.managedSiteIds ?? []).includes(site.id);
                return (
                  <label key={site.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      disabled={!canEditAgreement}
                      onChange={() => {
                        const current = employee.managedSiteIds ?? [];
                        onUpdate(employeeId, {
                          managedSiteIds: checked ? current.filter((id) => id !== site.id) : [...current, site.id],
                        });
                      }}
                    />
                    <span>{siteLabel(site.name, lang)}</span>
                  </label>
                );
              })}
            </div>
          </div>
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

      <EmployeeForms employeeId={employeeId} lang={lang} canWrite={canEditAgreement} api={forms} />

      <EmployeeAttendance employeeId={employeeId} lang={lang} load={loadAttendance} shared={sharedAttendance?.(employeeId)} />

      {employee.schedulable === false ? null : (
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
            {state.biz.shifts.filter((shift) => shiftVisible(employee, shift)).map((shift) => {
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
      )}
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
  const person = state.emps.find((item) => item.id === employeeId);
  const shifts = person ? state.biz.shifts.filter((shift) => shiftVisible(person, shift)) : state.biz.shifts;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[40rem] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="w-24" />
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const today = columnIsToday(state.week, day);
              return (
              <th key={day} scope="col" className={`px-1 pb-1 text-center align-top text-[11px] font-medium ${today ? "text-brand-text" : "text-muted"}`}>
                {mode === "availability" ? (
                  <>
                    <span className={`block ${today ? "text-brand-text" : "text-muted"}`}>{dayName(day, lang)}</span>
                    <DayDates week={state.week} day={day} lang={lang} today={today} />
                  </>
                ) : (
                  dayName(day, lang)
                )}
                <span aria-hidden="true" className={`mx-auto mt-1.5 block h-px w-8 ${today ? "bg-brand" : "bg-line"}`} />
              </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shifts.map((shift) => (
            <tr key={shift.id}>
              <th scope="row" className="pe-2 text-start text-xs font-semibold text-ink-soft">
                {shiftLabel(shift.name, lang)}
              </th>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const agreement = agreementCell(state, employeeId, day, shift.id);
                const availability = availabilityCell(state, employeeId, day, shift.id);
                const locked =
                  mode === "availability" && availability === "absent"
                    ? "absent"
                    : (mode === "agreement" && agreement === "shabbat") || (mode === "availability" && availability === "shabbat")
                      ? "shabbat"
                      : mode === "availability" && availability === "holiday"
                        ? "holiday"
                        : null;
                const closed = mode === "agreement" ? agreement === "closed" : availability === "closed";
                const forbidden = mode === "availability" && availability === "forbidden";
                const checked = mode === "agreement" ? agreement === "allowed" : availability === "available";
                const disabled = !editable || closed || forbidden || locked !== null;
                const label = `${dayName(day, lang)} ${shiftLabel(shift.name, lang)}`;
                const lockedLabel =
                  locked === "absent"
                    ? (() => {
                        const kind = absenceOnWeekDay(state, employeeId, day);
                        return kind === "sick" ? t.absenceSick : t.absenceVacation;
                      })()
                    : locked === "shabbat"
                      ? t.observanceShabbat
                      : t.observanceHoliday;
                const tone = closed || locked
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
                    {closed || forbidden || locked ? (
                      <span
                        className="block px-1 text-xs font-medium text-subtle"
                        data-testid={locked ? `${mode}-lock-${day}-${shift.name}` : undefined}
                        title={
                          locked === "absent"
                            ? t.absencesLock
                            : locked
                              ? locked === "shabbat"
                                ? t.observesShabbat
                                : t.observesHolidays
                              : closed
                                ? t.siteClosed
                                : t.agreementForbids
                        }
                        aria-label={`${label}: ${locked ? lockedLabel : closed ? t.siteClosed : t.agreementForbids}`}
                      >
                        {locked ? lockedLabel : closed ? t.closed : "—"}
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

function ObservanceSwitch({
  checked,
  label,
  hint,
  testId,
  disabled,
  onClick,
}: {
  checked: boolean;
  label: string;
  hint: string;
  testId: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        disabled={disabled}
        className={`relative mt-0.5 h-8 w-12 shrink-0 rounded-full disabled:opacity-50 ${checked ? "bg-brand" : "bg-well"}`}
        onClick={onClick}
      >
        <span
          className={`absolute top-1 start-1 h-6 w-6 rounded-full bg-card shadow-sm motion-safe:transition-transform motion-safe:duration-200 ${
            checked ? "translate-x-4 rtl:-translate-x-4" : ""
          }`}
        />
      </button>
    </div>
  );
}

function detailKey(person: Employee): string {
  return JSON.stringify({
    name: person.name,
    contact: person.contact,
    phone: person.phone ?? "",
    role: person.role,
    secondaryRoles: person.secondaryRoles ?? [],
    quals: person.quals,
    perWeek: person.perWeek,
    maxHours: person.maxHours,
    hourlyWage: person.hourlyWage ?? 0,
    active: person.active,
    shabbat: person.observesShabbat === true,
    holidays: person.observesHolidays === true,
    profile: employeeProfile(person),
    capabilities: person.capabilities ?? null,
    reportsTo: person.reportsTo ?? null,
    customBlocks: person.customBlocks ?? null,
    schedulable: person.schedulable !== false,
    homeSiteId: person.homeSiteId ?? null,
  });
}

function EmployeeDetails({
  lang,
  employee: saved,
  siteId,
  readOnly,
  hourCapHint,
  hourCapNone,
  blockHome,
  onUpdate,
  onDraft,
  roles,
  people,
  editorId,
  editorCapabilities,
  owner,
}: {
  lang: Lang;
  employee: Employee;
  siteId: string;
  readOnly: boolean;
  hourCapHint: string;
  hourCapNone: string;
  blockHome: { biz: Business; name: string; away: boolean } | null;
  onUpdate: (patch: EmployeePatch) => void;
  onDraft?: (draft: { dirty: boolean; save: () => void; discard: () => void } | null) => void;
  roles: string[];
  people: (ReportNode & { name: string })[];
  editorId: string | null;
  editorCapabilities: Capabilities;
  owner: boolean;
}) {
  const t = copy[lang];
  const [employee, setEmployee] = useState(saved);
  const savedKey = detailKey(saved);
  useEffect(() => setEmployee(saved), [savedKey]);
  function edit(patch: EmployeePatch) {
    setEmployee((current) => {
      const next = updateEmployee({ week: savedKey, biz: { name: "", type: "", minRest: 0, maxHours: 0, maxShift: 0, assume: true, shifts: [] }, emps: [current], avail: {}, sched: {}, closed: {} }, MANAGER, current.id, patch);
      return next.emps.find((item) => item.id === current.id) ?? current;
    });
  }
  const dirty = detailKey(employee) !== savedKey;
  function save() {
    if (!dirty) return;
    onUpdate({
      name: employee.name,
      contact: employee.contact,
      phone: employee.phone ?? "",
      role: employee.role,
      secondaryRoles: employee.secondaryRoles ?? [],
      quals: employee.quals,
      perWeek: employee.perWeek,
      maxHours: employee.maxHours,
      hourlyWage: employee.hourlyWage ?? 0,
      active: employee.active,
      observesShabbat: employee.observesShabbat === true,
      observesHolidays: employee.observesHolidays === true,
      profile: employeeProfile(employee),
      reportsTo: employee.reportsTo ?? null,
      customBlocks: employee.customBlocks ?? null,
      schedulable: employee.schedulable !== false,
      capabilities: employee.schedulable === false ? withoutShiftCapabilities(capabilitiesOf(employee)) : employee.capabilities,
      ...(employee.homeSiteId ? { homeSiteId: employee.homeSiteId } : {}),
    });
  }
  function discard() {
    setEmployee(saved);
  }
  useEffect(() => {
    onDraft?.({ dirty, save, discard });
  });
  useEffect(() => () => onDraft?.(null), [onDraft]);
  const profile = employeeProfile(employee);
  const setProfile = (patch: Partial<typeof profile>) => edit({ profile: patch });
  return (
    <div data-testid="employee-profile" className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-medium text-ink">{t.profilePersonal}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{t.profileOptional}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label={t.employeeName} value={employee.name} readOnly={readOnly} onCommit={(name) => edit({ name })} />
          <TextField
            label={t.nationalId}
            value={profile.nationalId}
            readOnly={readOnly}
            ltr
            testId="employee-national-id"
            onCommit={(nationalId) => setProfile({ nationalId })}
          />
          <DateField
            label={t.birthDate}
            value={profile.birthDate}
            readOnly={readOnly}
            testId="employee-birth-date"
            onCommit={(birthDate) => setProfile({ birthDate })}
          />
          <ChoiceField
            label={t.gender}
            value={profile.gender}
            readOnly={readOnly}
            testId="employee-gender"
            options={[
              { value: "female", label: t.genderFemale },
              { value: "male", label: t.genderMale },
            ]}
            onCommit={(gender) => setProfile({ gender })}
          />
          <ChoiceField
            label={t.maritalStatus}
            value={profile.maritalStatus}
            readOnly={readOnly}
            testId="employee-marital-status"
            options={[
              { value: "single", label: t.maritalSingle },
              { value: "married", label: t.maritalMarried },
              { value: "divorced", label: t.maritalDivorced },
              { value: "widowed", label: t.maritalWidowed },
            ]}
            onCommit={(maritalStatus) => setProfile({ maritalStatus })}
          />
        </div>
      </div>
      <div className="border-t border-line pt-6">
        <h3 className="text-sm font-medium text-ink">{t.profileContact}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label={t.contact} value={employee.contact} readOnly={readOnly} onCommit={(contact) => edit({ contact })} />
          <p className="text-xs leading-5 text-muted sm:col-span-2 lg:col-span-3">
            {saved.loginConfirmed === true ? t.loginOpen : saved.contact.trim() ? t.loginPending : t.loginNone}
          </p>
          <p className="text-xs leading-5 text-muted sm:col-span-2 lg:col-span-3">{t.loginEmailHint}</p>
          <TextField
            label={t.phone}
            value={employee.phone ?? ""}
            readOnly={readOnly}
            ltr
            testId="employee-phone"
            onCommit={(phone) => edit({ phone })}
          />
          <TextField label={t.city} value={profile.city} readOnly={readOnly} onCommit={(city) => setProfile({ city })} />
          <TextField label={t.street} value={profile.street} readOnly={readOnly} onCommit={(street) => setProfile({ street })} />
          <TextField
            label={t.houseNumber}
            value={profile.houseNumber}
            readOnly={readOnly}
            ltr
            onCommit={(houseNumber) => setProfile({ houseNumber })}
          />
          <TextField label={t.zip} value={profile.zip} readOnly={readOnly} ltr onCommit={(zip) => setProfile({ zip })} />
        </div>
      </div>
      <div className="border-t border-line pt-6">
        <h3 className="text-sm font-medium text-ink">{t.profileBank}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{t.bankOptional}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label={t.bankName} value={profile.bankName} readOnly={readOnly} onCommit={(bankName) => setProfile({ bankName })} />
          <TextField
            label={t.bankBranch}
            value={profile.bankBranch}
            readOnly={readOnly}
            ltr
            onCommit={(bankBranch) => setProfile({ bankBranch })}
          />
          <TextField
            label={t.bankAccount}
            value={profile.bankAccount}
            readOnly={readOnly}
            ltr
            testId="employee-bank-account"
            onCommit={(bankAccount) => setProfile({ bankAccount })}
          />
        </div>
      </div>
      <div className="border-t border-line pt-6">
        <h3 className="text-sm font-medium text-ink">{t.profileEmployment}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            label={t.employeeNumber}
            value={profile.employeeNumber}
            readOnly={readOnly}
            ltr
            testId="employee-number"
            onCommit={(employeeNumber) => setProfile({ employeeNumber })}
          />
          <label className={labelClass}>
            <span className={labelText}>{t.primaryRole}</span>
            <RoleChoice
              value={employee.role}
              roles={roles}
              emptyLabel={t.noRole}
              label={t.primaryRole}
              readOnly={readOnly}
              onChange={(role) => edit({ role })}
            />
          </label>
          <TextField label={t.department} value={profile.department} readOnly={readOnly} onCommit={(department) => setProfile({ department })} />
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-sm font-medium text-ink-soft">{t.secondaryRoles}</p>
            <p className="mt-1 text-sm leading-6 text-muted">{t.secondaryRolesHint}</p>
            {roles.filter((role) => role.toLowerCase() !== employee.role.trim().toLowerCase()).length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                {roles
                  .filter((role) => role.toLowerCase() !== employee.role.trim().toLowerCase())
                  .map((role) => {
                    const checked = (employee.secondaryRoles ?? []).some((item) => item.toLowerCase() === role.toLowerCase());
                    return (
                      <label key={role} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          disabled={readOnly}
                          data-testid={`secondary-role-${role}`}
                          onChange={() => {
                            const current = employee.secondaryRoles ?? [];
                            edit({
                              secondaryRoles: checked
                                ? current.filter((item) => item.toLowerCase() !== role.toLowerCase())
                                : [...current, role],
                            });
                          }}
                        />
                        <span>{role}</span>
                      </label>
                    );
                  })}
              </div>
            ) : null}
          </div>
          <TextField label={t.qualifications} value={employee.quals} readOnly={readOnly} onCommit={(quals) => edit({ quals })} />
          <DateField
            label={t.startedOn}
            value={profile.startedOn}
            readOnly={readOnly}
            testId="employee-started-on"
            onCommit={(startedOn) => setProfile({ startedOn })}
          />
          <DateField label={t.endedOn} value={profile.endedOn} readOnly={readOnly} onCommit={(endedOn) => setProfile({ endedOn })} />
          <NumberField label={t.quota} value={employee.perWeek} readOnly={readOnly} onCommit={(perWeek) => edit({ perWeek })} />
          <NumberField
            label={t.hourlyWage}
            value={employee.hourlyWage ?? 0}
            readOnly={readOnly}
            testId="hourly-wage"
            onCommit={(hourlyWage) => edit({ hourlyWage })}
          />
          <NumberField
            label={t.hourCap}
            hint={hourCapHint}
            noneLabel={hourCapNone}
            value={employee.maxHours}
            readOnly={readOnly}
            onCommit={(maxHours) => edit({ maxHours })}
          />
          <label className="flex h-10 items-center gap-2 self-end text-sm font-medium">
            <input
              type="checkbox"
              data-testid="employee-active"
              className="h-4 w-4"
              checked={employee.active}
              disabled={readOnly}
              onChange={(event) => edit({ active: event.target.checked })}
            />
            {employee.active ? t.active : t.inactive}
          </label>
        </div>
        <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5">
          {isSiteManager(saved) ? (
            <ObservanceSwitch
              label={t.personSchedulable}
              hint={t.personSchedulableHint}
              checked={employee.schedulable !== false}
              testId="person-schedulable"
              disabled={readOnly}
              onClick={() =>
                edit({
                  schedulable: employee.schedulable === false,
                  ...(employee.schedulable === false
                    ? !employee.homeSiteId && siteId
                      ? { homeSiteId: siteId }
                      : {}
                    : { capabilities: withoutShiftCapabilities(capabilitiesOf(employee)) }),
                })
              }
            />
          ) : null}
          {employee.schedulable !== false ? (
          <ObservanceSwitch
            label={t.observesShabbat}
            hint={t.observesShabbatHint}
            checked={employee.observesShabbat === true}
            testId="observes-shabbat"
            disabled={readOnly}
            onClick={() =>
              edit(
                employee.observesShabbat === true
                  ? { observesShabbat: false, observesHolidays: false }
                  : { observesShabbat: true, observesHolidays: true },
              )
            }
          />
          ) : null}
          {employee.schedulable !== false && employee.observesShabbat === true ? (
            <ObservanceSwitch
              label={t.observesHolidays}
              hint={t.observesHolidaysHint}
              checked={employee.observesHolidays === true}
              testId="observes-holidays"
              disabled={readOnly}
              onClick={() => edit({ observesHolidays: employee.observesHolidays !== true })}
            />
          ) : null}
        </div>
        <EmployeeAuthority
          lang={lang}
          people={people}
          employee={employee}
          editorId={editorId}
          editorCapabilities={editorCapabilities}
          owner={owner}
          readOnly={readOnly}
          onCapabilities={(capabilities) => edit({ capabilities })}
          onReportsTo={(reportsTo) => edit({ reportsTo })}
        />
        {blockHome?.biz.blockLimit === true ? (
          <div className="mt-5 border-t border-line pt-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{t.customBlocksTitle}</p>
                <p className="mt-1 text-sm leading-6 text-muted">{t.customBlocksHint}</p>
                {heldRoles(employee).length >= 2 ? <p className="mt-1 text-sm leading-6 text-muted">{t.customBlocksPerRole}</p> : null}
                {blockHome.away ? <p className="mt-1 text-sm text-muted">{t.customBlocksHome(blockHome.name)}</p> : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(employee.customBlocks)}
                aria-label={t.customBlocksTitle}
                data-testid="custom-blocks"
                disabled={readOnly}
                className={`relative h-8 w-12 shrink-0 rounded-full disabled:opacity-50 ${employee.customBlocks ? "bg-brand" : "bg-well"}`}
                onClick={() => edit({ customBlocks: employee.customBlocks ? null : customFromSite(blockHome.biz) })}
              >
                <span
                  className={`absolute top-1 start-1 h-6 w-6 rounded-full bg-card shadow-sm motion-safe:transition-transform motion-safe:duration-200 ${
                    employee.customBlocks ? "translate-x-4 rtl:-translate-x-4" : ""
                  }`}
                />
              </button>
            </div>
            {employee.customBlocks ? (
              <BlockNumberFields
                lang={lang}
                split={blockSplitOf(blockHome.biz)}
                shifts={blockHome.biz.shifts.filter((shift) => shiftVisible(employee, shift))}
                max={employee.customBlocks.max}
                weekday={employee.customBlocks.weekday}
                weekend={employee.customBlocks.weekend}
                shiftCaps={employee.customBlocks.shifts}
                readOnly={readOnly}
                idPrefix="custom-"
                onMax={(max) => edit({ customBlocks: { ...employee.customBlocks!, max } })}
                onWeekday={(weekday) => edit({ customBlocks: { ...employee.customBlocks!, weekday } })}
                onWeekend={(weekend) => edit({ customBlocks: { ...employee.customBlocks!, weekend } })}
                onShift={(shiftId, value) =>
                  edit({ customBlocks: { ...employee.customBlocks!, shifts: { ...employee.customBlocks!.shifts, [shiftId]: value } } })
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onCommit,
  readOnly = false,
  ltr = false,
  testId,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  readOnly?: boolean;
  ltr?: boolean;
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
        dir={ltr ? "ltr" : undefined}
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

function DateField({
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
  return (
    <label className={labelClass}>
      <span className={labelText}>{label}</span>
      <input
        type="date"
        data-testid={testId}
        value={value}
        readOnly={readOnly}
        dir="ltr"
        onChange={(event) => {
          if (readOnly || event.target.value === value) return;
          onCommit(event.target.value);
        }}
        className={field}
      />
    </label>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onCommit,
  readOnly = false,
  testId,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onCommit: (value: string) => void;
  readOnly?: boolean;
  testId?: string;
}) {
  return (
    <label className={labelClass}>
      <span className={labelText}>{label}</span>
      <select
        data-testid={testId}
        value={value}
        disabled={readOnly}
        onChange={(event) => onCommit(event.target.value)}
        className={select}
      >
        <option value=""></option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

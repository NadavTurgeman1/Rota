import { useEffect, useState } from "react";
import { dayName, type Employee, type Lang, type RotaState } from "../domain";
import { employeeProfile } from "../domain/profile";
import { isRelief } from "../domain/relief";
import { confirmDeleteEmployee, copy } from "../i18n/copy";
import { columnIsToday, shiftLabel, siteLabel } from "../schedule/display";
import { agreementCell, availabilityCell, type EmployeePatch } from "../people/edit";
import { EmployeeAttendance, type AttendanceApi } from "./attendance";
import { DayDates } from "./day-dates";
import { NameRail } from "./name-rail";
import { button, card, cardHint, cardTitle, field, label as labelClass, labelText, select, surface } from "./ui";

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
  loadAttendance,
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
  loadAttendance: AttendanceApi["employee"];
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
          loadAttendance={loadAttendance}
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
  loadAttendance,
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
  loadAttendance: AttendanceApi["employee"];
}) {
  const t = copy[lang];
  const employee = state.emps.find((item) => item.id === employeeId)!;
  const [agreementLocked, setAgreementLocked] = useState(true);
  const agreementEditable = canEditAgreement && !agreementLocked;

  return (
    <div data-testid="employee-card" className="flex flex-col gap-6">
      <section className={card}>
        <EmployeeDetails
          lang={lang}
          employee={employee}
          readOnly={!canEditAgreement}
          hourCapHint={`${t.hourCapHint} (${state.biz.maxHours})`}
          hourCapNone={t.hourCapNone}
          onUpdate={(patch) => onUpdate(employeeId, patch)}
        />
        {sites.length > 0 ? (
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

      <EmployeeAttendance employeeId={employeeId} lang={lang} load={loadAttendance} />

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

function EmployeeDetails({
  lang,
  employee,
  readOnly,
  hourCapHint,
  hourCapNone,
  onUpdate,
}: {
  lang: Lang;
  employee: Employee;
  readOnly: boolean;
  hourCapHint: string;
  hourCapNone: string;
  onUpdate: (patch: EmployeePatch) => void;
}) {
  const t = copy[lang];
  const profile = employeeProfile(employee);
  const setProfile = (patch: Partial<typeof profile>) => onUpdate({ profile: patch });
  return (
    <div data-testid="employee-profile" className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-medium text-ink">{t.profilePersonal}</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label={t.employeeName} value={employee.name} readOnly={readOnly} onCommit={(name) => onUpdate({ name })} />
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
          <TextField label={t.contact} value={employee.contact} readOnly={readOnly} onCommit={(contact) => onUpdate({ contact })} />
          <TextField
            label={t.phone}
            value={employee.phone ?? ""}
            readOnly={readOnly}
            ltr
            testId="employee-phone"
            onCommit={(phone) => onUpdate({ phone })}
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
          <TextField label={t.role} value={employee.role} readOnly={readOnly} onCommit={(role) => onUpdate({ role })} />
          <TextField label={t.department} value={profile.department} readOnly={readOnly} onCommit={(department) => setProfile({ department })} />
          <TextField label={t.qualifications} value={employee.quals} readOnly={readOnly} onCommit={(quals) => onUpdate({ quals })} />
          <DateField
            label={t.startedOn}
            value={profile.startedOn}
            readOnly={readOnly}
            testId="employee-started-on"
            onCommit={(startedOn) => setProfile({ startedOn })}
          />
          <DateField label={t.endedOn} value={profile.endedOn} readOnly={readOnly} onCommit={(endedOn) => setProfile({ endedOn })} />
          <NumberField label={t.quota} value={employee.perWeek} readOnly={readOnly} onCommit={(perWeek) => onUpdate({ perWeek })} />
          <NumberField
            label={t.hourlyWage}
            value={employee.hourlyWage ?? 0}
            readOnly={readOnly}
            testId="hourly-wage"
            onCommit={(hourlyWage) => onUpdate({ hourlyWage })}
          />
          <NumberField
            label={t.hourCap}
            hint={hourCapHint}
            noneLabel={hourCapNone}
            value={employee.maxHours}
            readOnly={readOnly}
            onCommit={(maxHours) => onUpdate({ maxHours })}
          />
          <label className="flex h-10 items-center gap-2 self-end text-sm font-medium">
            <input
              type="checkbox"
              data-testid="employee-active"
              className="h-4 w-4"
              checked={employee.active}
              disabled={readOnly}
              onChange={(event) => onUpdate({ active: event.target.checked })}
            />
            {employee.active ? t.active : t.inactive}
          </label>
        </div>
      </div>
      <div className="border-t border-line pt-6">
        <h3 className="text-sm font-medium text-ink">{t.profileBank}</h3>
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

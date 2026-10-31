import { CAPABILITY_KEYS, type Capabilities, type Capability, type Lang } from "../domain";
import { capabilitiesOf, grantable, isAncestor, transferTargets, type ReportNode } from "../access/hierarchy";
import { copy } from "../i18n/copy";
import { select } from "./ui";

const CAPTION: Record<Capability, "capClock" | "capConstraints" | "capAbsences" | "capTrades" | "capScheduleView" | "capScheduleEdit" | "capSiteSettings" | "capPeopleSite" | "capPeopleEdit" | "capMessages" | "capInsights" | "capDocuments"> = {
  clock: "capClock",
  constraints: "capConstraints",
  absences: "capAbsences",
  trades: "capTrades",
  schedule_view: "capScheduleView",
  schedule_edit: "capScheduleEdit",
  site_settings: "capSiteSettings",
  people_site: "capPeopleSite",
  people_edit: "capPeopleEdit",
  messages: "capMessages",
  insights: "capInsights",
  documents: "capDocuments",
};

export function EmployeeAuthority({
  lang,
  people,
  employee,
  editorId,
  editorCapabilities,
  owner,
  readOnly,
  onCapabilities,
  onReportsTo,
}: {
  lang: Lang;
  people: (ReportNode & { name: string })[];
  employee: ReportNode & { name: string };
  editorId: string | null;
  editorCapabilities: Capabilities;
  owner: boolean;
  readOnly: boolean;
  onCapabilities: (capabilities: Capabilities) => void;
  onReportsTo: (managerId: string) => void;
}) {
  const t = copy[lang];
  const caps = capabilitiesOf(employee);
  const manager = people.find((person) => person.id === employee.reportsTo);
  const targets = transferTargets(people, employee.id, editorId, owner);
  const currentManager = employee.reportsTo ?? "";
  const canMove =
    !readOnly &&
    targets.some((id) => id !== currentManager) &&
    (owner || editorId === employee.openedBy || (editorId ? isAncestor(people, editorId, employee.id) : false));
  const grant = (key: Capability, on: boolean) => {
    const requested = { ...caps, [key]: on };
    if (key === "schedule_edit" && on) requested.schedule_view = true;
    onCapabilities(grantable(editorCapabilities, requested, owner));
  };

  return (
    <div className="mt-5 border-t border-line pt-5">
      <h3 className="text-sm font-medium text-ink">{t.authorityTitle}</h3>
      <p className="mt-1 max-w-xl text-sm leading-6 text-muted">{t.authorityHint}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <p className="text-sm text-ink">
          <span className="text-muted">{t.directManager}</span>
          <span className="mt-1 block font-medium">{manager ? nameOf(people, manager.id) : t.directManagerEmpty}</span>
        </p>
        {canMove ? (
          <label className="block text-sm text-ink">
            <span className="text-muted">{t.transferManager}</span>
            <select
              className={`${select} mt-1 w-full`}
              data-testid="transfer-manager"
              value={targets.includes(currentManager) ? currentManager : ""}
              onChange={(event) => {
                if (event.target.value) onReportsTo(event.target.value);
              }}
            >
              {targets.includes(currentManager) ? null : (
                <option value="">{manager ? nameOf(people, manager.id) : t.directManagerEmpty}</option>
              )}
              {targets.map((id) => (
                <option key={id} value={id}>
                  {nameOf(people, id)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITY_KEYS.map((key) => {
          const allowed = owner || editorCapabilities[key];
          return (
            <label key={key} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="h-4 w-4"
                data-testid={`capability-${key}`}
                checked={caps[key]}
                disabled={readOnly || !allowed}
                onChange={(event) => grant(key, event.target.checked)}
              />
              {t[CAPTION[key]]}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function nameOf(people: { id: string; name: string }[], id: string): string {
  return people.find((person) => person.id === id)?.name ?? id;
}

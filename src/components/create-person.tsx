import { useState } from "react";
import { CAPABILITY_KEYS, MANAGEMENT_CAPABILITIES, type Capabilities, type Capability, type Lang } from "../domain";
import { grantable, staffCapabilities } from "../access/hierarchy";
import { copy } from "../i18n/copy";
import { button, cardTitle, field, label as labelClass, labelText } from "./ui";

export type PersonPlace = "work" | "lead" | "both";

export interface NewPerson {
  name: string;
  phone: string;
  email: string;
  place: PersonPlace;
  capabilities: Capabilities;
  managedSiteIds: string[];
}

const PERSONAL: Capability[] = ["clock", "constraints", "absences", "trades", "schedule_view"];

const CAPTION = {
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
} as const;

export function CreatePerson({
  lang,
  sites,
  siteId,
  editorCapabilities,
  owner,
  onCreate,
  onCancel,
}: {
  lang: Lang;
  sites: { id: string; name: string }[];
  siteId: string;
  editorCapabilities: Capabilities;
  owner: boolean;
  onCreate: (person: NewPerson) => void;
  onCancel: () => void;
}) {
  const t = copy[lang];
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [place, setPlace] = useState<PersonPlace>("work");
  const [caps, setCaps] = useState<Capabilities>(() => grantable(editorCapabilities, staffCapabilities(), owner));
  const [managed, setManaged] = useState<string[]>([siteId]);
  const leads = place !== "work";
  const works = place !== "lead";
  const allowed = (key: Capability) => owner || editorCapabilities[key];

  function choosePlace(next: PersonPlace) {
    setPlace(next);
    if (next === "work") setCaps(grantable(editorCapabilities, staffCapabilities(), owner));
    if (next === "lead") {
      setCaps(grantable(editorCapabilities, { ...staffCapabilities(), people_edit: true, messages: true }, owner));
    }
    if (next === "both") {
      setCaps(
        grantable(editorCapabilities, { ...staffCapabilities(), people_edit: true, schedule_edit: true, messages: true }, owner),
      );
    }
  }

  function toggle(key: Capability) {
    const requested = { ...caps, [key]: !caps[key] };
    if (key === "schedule_edit" && requested.schedule_edit) requested.schedule_view = true;
    setCaps(grantable(editorCapabilities, requested, owner));
  }

  const keys = CAPABILITY_KEYS.filter((key) => (leads ? true : PERSONAL.includes(key)));
  const personalKeys = keys.filter((key) => PERSONAL.includes(key));
  const managementKeys = keys.filter((key) => (MANAGEMENT_CAPABILITIES as readonly string[]).includes(key));

  return (
    <form
      data-testid="create-person"
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        if (leads && managed.length === 0) return;
        onCreate({
          name: trimmed,
          phone: phone.trim(),
          email: email.trim(),
          place,
          capabilities: caps,
          managedSiteIds: leads ? managed : [],
        });
      }}
    >
      <div>
        <h2 className={cardTitle}>{t.createPerson}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{works ? (leads ? t.personBothHint : t.personWorkerHint) : t.personLeadHint}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            ["work", t.personWorker],
            ["lead", t.personLead],
            ["both", t.personBoth],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            data-testid={`person-place-${id}`}
            aria-pressed={place === id}
            className={`h-10 rounded-lg border px-3 text-sm ${place === id ? "border-brand bg-brand-soft text-ink" : "border-line bg-card text-ink-soft hover:bg-well"}`}
            onClick={() => choosePlace(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          <span className={labelText}>{t.employeeName}</span>
          <input className={field} value={name} data-testid="create-person-name" onChange={(event) => setName(event.target.value)} />
        </label>
        <label className={labelClass}>
          <span className={labelText}>{t.phone}</span>
          <input className={field} value={phone} dir="ltr" onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          <span className={labelText}>{t.personEmail}</span>
          <input className={field} value={email} dir="ltr" type="email" onChange={(event) => setEmail(event.target.value)} />
        </label>
      </div>
      {leads ? (
        <div>
          <h3 className="text-sm font-medium text-ink">{t.managedSites}</h3>
          <div className="mt-2 flex flex-col gap-2">
            {sites.map((site) => (
              <label key={site.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={managed.includes(site.id)}
                  onChange={() =>
                    setManaged((current) => (current.includes(site.id) ? current.filter((id) => id !== site.id) : [...current, site.id]))
                  }
                />
                {site.name}
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <div>
        <h3 className="text-sm font-medium text-ink">{t.authorityTitle}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {personalKeys.map((key) => (
            <Cap key={key} id={key} label={t[CAPTION[key]]} checked={caps[key]} disabled={!allowed(key)} onToggle={() => toggle(key)} />
          ))}
        </div>
        {managementKeys.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {managementKeys.map((key) => (
              <Cap key={key} id={key} label={t[CAPTION[key]]} checked={caps[key]} disabled={!allowed(key)} onToggle={() => toggle(key)} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <button type="submit" data-testid="add-person" className={button.primary} disabled={!name.trim() || (leads && managed.length === 0)}>
          {t.createPerson}
        </button>
        <button type="button" className={button.quiet} onClick={onCancel}>
          {t.cancelSelection}
        </button>
      </div>
    </form>
  );
}

function Cap({
  id,
  label,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" className="h-4 w-4" data-testid={`create-cap-${id}`} checked={checked} disabled={disabled} onChange={onToggle} />
      {label}
    </label>
  );
}

import { useState } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { filterNames } from "../people/names";
import { field } from "./ui";

type RailPerson = { id: string; name: string; hint?: string; submitted?: boolean };
type RailGroup = { title: string; people: RailPerson[] };

export function NameRail({
  people,
  title,
  groups = [],
  trailing,
  selectedId,
  onSelect,
  lang,
  testId,
}: {
  people: RailPerson[];
  title?: string;
  groups?: RailGroup[];
  trailing?: { title: string; people: RailPerson[] };
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang: Lang;
  testId: string;
}) {
  const t = copy[lang];
  const [query, setQuery] = useState("");
  const shown = filterNames(people, query);
  const shownGroups = groups
    .map((group) => ({ title: group.title, people: filterNames(group.people, query) }))
    .filter((group) => group.people.length > 0);
  const extra = trailing?.people ?? [];
  const shownExtra = filterNames(extra, query);
  const total = people.length + extra.length + groups.reduce((sum, group) => sum + group.people.length, 0);
  const shownCount = shown.length + shownExtra.length + shownGroups.reduce((sum, group) => sum + group.people.length, 0);
  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label={t.nameSearch}
        data-testid={`${testId}-search`}
        placeholder={t.nameSearch}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={field}
      />
      {total === 0 ? <p className="px-3 py-2 text-sm text-muted">{t.noEmployees}</p> : null}
      {total > 0 && shownCount === 0 ? <p className="px-3 py-2 text-sm text-muted">{t.noNameMatches}</p> : null}
      {title && shown.length > 0 ? (
        <h3 className="px-3 pt-1 text-xs font-semibold text-muted">{title}</h3>
      ) : null}
      <PersonList people={shown} selectedId={selectedId} onSelect={onSelect} testId={testId} lang={lang} />
      {shownGroups.map((group) => (
        <div key={group.title}>
          <h3 data-testid={`${testId}-group`} className="px-3 pt-2 text-xs font-semibold text-muted">
            {group.title}
          </h3>
          <PersonList people={group.people} selectedId={selectedId} onSelect={onSelect} testId={testId} lang={lang} />
        </div>
      ))}
      {shownExtra.length > 0 ? (
        <>
          <h3 data-testid={`${testId}-relief`} className="px-3 pt-2 text-xs font-semibold text-muted">
            {trailing?.title}
          </h3>
          <PersonList people={shownExtra} selectedId={selectedId} onSelect={onSelect} testId={testId} lang={lang} />
        </>
      ) : null}
    </div>
  );
}

function PersonList({
  people,
  selectedId,
  onSelect,
  testId,
  lang,
}: {
  people: RailPerson[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  testId: string;
  lang: Lang;
}) {
  const t = copy[lang];
  return (
    <ul className="flex flex-col gap-1">
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            data-testid={`${testId}-${person.id}`}
            aria-pressed={person.id === selectedId}
            className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-sm ${
              person.id === selectedId ? "bg-well font-medium text-ink" : "text-muted hover:bg-well/80 hover:text-ink"
            }`}
            onClick={() => onSelect(person.id)}
          >
            <span className="flex min-w-0 items-center gap-2">
              {person.submitted ? (
                <span
                  data-testid={`${testId}-submitted-${person.id}`}
                  className="h-2 w-2 shrink-0 rounded-full bg-ok-text"
                  title={t.submittedShort}
                />
              ) : null}
              <span className="truncate font-medium">{person.name}</span>
            </span>
            {person.hint ? <span className="shrink-0 text-xs text-muted">{person.hint}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

import { useState } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { filterNames } from "../people/names";
import { field } from "./ui";

type RailPerson = { id: string; name: string; hint?: string; submitted?: boolean };

export function NameRail({
  people,
  trailing,
  selectedId,
  onSelect,
  lang,
  testId,
}: {
  people: RailPerson[];
  trailing?: { title: string; people: RailPerson[] };
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang: Lang;
  testId: string;
}) {
  const t = copy[lang];
  const [query, setQuery] = useState("");
  const shown = filterNames(people, query);
  const extra = trailing?.people ?? [];
  const shownExtra = filterNames(extra, query);
  const nobody = people.length === 0 && extra.length === 0;
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
      {nobody ? <p className="px-3 py-2 text-sm text-muted">{t.noEmployees}</p> : null}
      {people.length + extra.length > 0 && shown.length + shownExtra.length === 0 ? (
        <p className="px-3 py-2 text-sm text-muted">{t.noNameMatches}</p>
      ) : null}
      <PersonList people={shown} selectedId={selectedId} onSelect={onSelect} testId={testId} lang={lang} />
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
            className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-sm ${
              person.id === selectedId ? "bg-brand-soft text-brand-text" : "text-ink hover:bg-well"
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

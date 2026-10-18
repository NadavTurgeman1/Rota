import { useState } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { filterNames } from "../people/names";
import { field } from "./ui";

export function NameRail({
  people,
  selectedId,
  onSelect,
  lang,
  testId,
}: {
  people: { id: string; name: string; hint?: string; submitted?: boolean }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang: Lang;
  testId: string;
}) {
  const t = copy[lang];
  const [query, setQuery] = useState("");
  const shown = filterNames(people, query);
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
      {people.length === 0 ? <p className="px-3 py-2 text-sm text-muted">{t.noEmployees}</p> : null}
      {people.length > 0 && shown.length === 0 ? <p className="px-3 py-2 text-sm text-muted">{t.noNameMatches}</p> : null}
      <ul className="flex flex-col gap-1">
        {shown.map((person) => (
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
    </div>
  );
}

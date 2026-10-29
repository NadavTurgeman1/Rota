"use client";

import { useState, type ReactNode } from "react";

/** Closed groups of suggestions. Empty groups are left out. One group opens at a time. */
export function SolutionGroups({
  testId,
  groups,
}: {
  testId: string;
  groups: { id: string; title: string; items: ReactNode[] }[];
}) {
  const visible = groups.filter((group) => group.items.length > 0);
  const [open, setOpen] = useState<string | null>(null);
  if (visible.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1" data-testid={testId}>
      {visible.map((group) => {
        const expanded = open === group.id;
        return (
          <div key={group.id}>
            <button
              type="button"
              data-testid={`${testId}-${group.id}`}
              aria-expanded={expanded}
              aria-controls={`${testId}-${group.id}-list`}
              className="flex h-8 w-full items-center justify-between gap-2 rounded-lg bg-card px-2.5 text-start text-xs font-medium text-ink hover:bg-well"
              onClick={() => setOpen(expanded ? null : group.id)}
            >
              <span className="min-w-0 truncate">{group.title}</span>
              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-muted">
                {group.items.length}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                  fill="currentColor"
                >
                  <path d="M5.2 7.5a.75.75 0 0 1 1.06 0L10 11.2l3.74-3.7a.75.75 0 1 1 1.06 1.06l-4.27 4.24a.75.75 0 0 1-1.06 0L5.2 8.56a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </span>
            </button>
            {expanded ? (
              <div id={`${testId}-${group.id}-list`} className="mt-1 flex flex-col gap-1">
                {group.items}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

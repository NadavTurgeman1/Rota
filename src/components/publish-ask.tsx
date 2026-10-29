"use client";

import { useEffect, useRef } from "react";
import type { LaborNote, Lang } from "../domain";
import { copy, publishProblems } from "../i18n/copy";
import { button, card, cardTitle } from "./ui";

/** Asks before a week with problems is published. Staying on the draft is the dismiss. */
export function PublishAsk({
  lang,
  violations,
  unfilled,
  coverage,
  onPublish,
  onStay,
}: {
  lang: Lang;
  violations: number;
  unfilled: number;
  coverage: number;
  onPublish: () => void;
  onStay: () => void;
}) {
  const t = copy[lang];
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onStay();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onStay}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-ask-title"
        aria-describedby="publish-ask-body"
        tabIndex={-1}
        data-testid="publish-ask"
        className={`${card} pop-in pop-in-center w-full max-w-md outline-none`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="publish-ask-title" className={cardTitle}>
          {t.publishAskTitle}
        </h2>
        <p id="publish-ask-body" className="mt-2 text-sm leading-6 text-ink">
          {publishProblems(lang, violations, unfilled, coverage)}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" data-testid="publish-anyway" className={button.primary} onClick={onPublish}>
            {t.publishAnyway}
          </button>
          <button type="button" data-testid="publish-stay" className={button.quiet} onClick={onStay}>
            {t.publishStay}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Warns before publishing a week that breaks the Hours of Work and Rest Law. Seven days in a row is a blocking problem, not this warning. */
export function LaborAsk({
  lang,
  notes,
  onPublish,
  onStay,
}: {
  lang: Lang;
  notes: LaborNote[];
  onPublish: () => void;
  onStay: () => void;
}) {
  const t = copy[lang];
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onStay();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onStay}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="labor-ask-title"
        aria-describedby="labor-ask-body"
        tabIndex={-1}
        data-testid="labor-ask"
        className={`${card} pop-in pop-in-center w-full max-w-md outline-none`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="labor-ask-title" className={cardTitle}>
          {t.laborTitle}
        </h2>
        <p id="labor-ask-body" className="mt-2 text-sm leading-6 text-ink">
          {t.laborAskLead}
        </p>
        <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {notes.map((note) => (
            <li key={note.key} className="rounded-xl border border-warn-line/40 bg-warn-softer px-3 py-2 text-sm leading-6">
              {note.message}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" data-testid="labor-publish" className={button.primary} onClick={onPublish}>
            {t.publishAnyway}
          </button>
          <button type="button" data-testid="labor-stay" className={button.quiet} onClick={onStay}>
            {t.publishStay}
          </button>
        </div>
      </div>
    </div>
  );
}

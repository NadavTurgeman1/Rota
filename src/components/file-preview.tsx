"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import { button, card, cardTitle } from "./ui";

/** Same preview used for employee forms and absence documents. */
export function FilePreview({
  lang,
  name,
  url,
  type,
  text,
  onClose,
}: {
  lang: Lang;
  name: string;
  url: string;
  type: string;
  text: string | null;
  onClose: () => void;
}) {
  const t = copy[lang];
  const dialog = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    dialog.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
        tabIndex={-1}
        data-testid="file-preview"
        className={`${card} pop-in pop-in-center flex min-h-0 max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-y-auto outline-none`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="file-preview-title" className={`${cardTitle} min-w-0 break-words`}>
            <bdi>{name}</bdi>
          </h2>
          <div className="flex shrink-0 gap-2">
            <a href={url} download={name} className={button.quiet}>
              {t.employeeFormsDownload}
            </a>
            <button type="button" className={button.primary} onClick={onClose}>
              {t.employeeFormsClose}
            </button>
          </div>
        </div>
        {text !== null ? (
          <pre data-testid="file-preview-text" dir="auto" className="mt-4 max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-card p-4 text-sm leading-6">
            {text}
          </pre>
        ) : type.startsWith("image/") ? (
          <img src={url} alt={name} className="mt-4 max-h-[70vh] w-full object-contain" />
        ) : type === "application/pdf" ? (
          <iframe title={name} src={url} className="mt-4 h-[70vh] w-full rounded-lg border border-line bg-card" />
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted">{t.employeeFormsOpenHint}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}

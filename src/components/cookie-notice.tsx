"use client";

import { useEffect, useState } from "react";
import type { Lang } from "../domain";
import { copy } from "../i18n/copy";

export const COOKIE_NOTICE_KEY = "rota.cookieNotice";

/** Explains essential device storage. It does not block the screen and it does not ask for tracking consent. */
export function CookieNotice({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(window.localStorage.getItem(COOKIE_NOTICE_KEY) !== "1");
  }, []);
  if (!open) return null;
  return (
    <div className="mt-6 rounded-xl border border-line bg-card p-4 text-sm leading-6 text-ink" data-testid="cookie-notice" role="region" aria-label={t.cookiePolicy}>
      <p>{t.cookieNotice}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <a href={`/legal/cookies?lang=${lang}`} className="font-semibold underline decoration-1 underline-offset-4">
          {t.cookiePolicy}
        </a>
        <button
          type="button"
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover"
          onClick={() => {
            window.localStorage.setItem(COOKIE_NOTICE_KEY, "1");
            setOpen(false);
          }}
        >
          {t.cookieNoticeDismiss}
        </button>
      </div>
    </div>
  );
}

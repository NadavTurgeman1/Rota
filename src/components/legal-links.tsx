import type { Lang } from "../domain";
import { copy } from "../i18n/copy";
import type { LegalPageId } from "../legal/content";

const PAGES: LegalPageId[] = ["privacy", "terms", "refund", "cookies"];

export function legalHref(page: LegalPageId, lang: Lang): string {
  return `/legal/${page}?lang=${lang}`;
}

export function LegalLinks({ lang, className = "" }: { lang: Lang; className?: string }) {
  const t = copy[lang];
  const label = {
    privacy: t.privacyPolicy,
    terms: t.termsOfService,
    refund: t.refundPolicy,
    cookies: t.cookiePolicy,
  };
  return (
    <nav aria-label={t.legalDocuments} className={className}>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {PAGES.map((page) => (
          <li key={page}>
            <a href={legalHref(page, lang)} className="text-sm font-semibold underline decoration-1 underline-offset-4">
              {label[page]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

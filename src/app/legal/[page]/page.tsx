import { notFound } from "next/navigation";
import type { Lang } from "../../../domain";
import { isLegalPage, legalDocument, legalLang, LEGAL_PAGES } from "../../../legal/content";

const HOME: Record<Lang, string> = { he: "חזרה ל-Rota", en: "Back to Rota", ru: "Назад в Rota" };
const UPDATED: Record<Lang, string> = { he: "עודכן", en: "Updated", ru: "Обновлено" };
const LANGS: { id: Lang; label: string }[] = [
  { id: "he", label: "עברית" },
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
];

export function generateStaticParams() {
  return LEGAL_PAGES.map((page) => ({ page }));
}

export default async function LegalRoute({
  params,
  searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { page } = await params;
  if (!isLegalPage(page)) notFound();
  const { lang: requested } = await searchParams;
  const lang = legalLang(requested);
  const document = legalDocument(page, lang);
  return (
    <main dir={lang === "he" ? "rtl" : "ltr"} lang={lang} className="mx-auto min-h-dvh max-w-2xl bg-page px-6 py-10 text-ink">
      <a href="/" className="text-sm font-semibold underline decoration-1 underline-offset-4">
        {HOME[lang]}
      </a>
      <div className="mt-6 flex flex-wrap gap-2">
        {LANGS.map((item) => (
          <a
            key={item.id}
            href={`/legal/${page}?lang=${item.id}`}
            lang={item.id}
            aria-current={item.id === lang ? "true" : undefined}
            className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium ${
              item.id === lang ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">{document.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {UPDATED[lang]} {document.updated}
      </p>
      {document.sections.map((section) => (
        <section key={section.heading} className="mt-8">
          <h2 className="text-base font-semibold">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2 text-sm leading-6 text-ink">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}

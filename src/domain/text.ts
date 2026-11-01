import type { Lang } from "./rules";

/** Picks the sentence for the active language. */
export function tx(lang: Lang, he: string, en: string, ru: string): string {
  if (lang === "he") return he;
  if (lang === "ru") return ru;
  return en;
}

export function localeOf(lang: Lang): string {
  if (lang === "he") return "he-IL";
  if (lang === "ru") return "ru-RU";
  return "en-GB";
}

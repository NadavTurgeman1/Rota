import { describe, expect, it } from "vitest";
import { LEGAL_PAGES, legalDocument } from "./content";

describe("legal documents", () => {
  it("has the same pages in Hebrew, English, and Russian", () => {
    for (const page of LEGAL_PAGES) {
      const documents = (["he", "en", "ru"] as const).map((lang) => legalDocument(page, lang));
      const [hebrew, english, russian] = documents;
      expect(hebrew.sections.length).toBe(english.sections.length);
      expect(hebrew.sections.length).toBe(russian.sections.length);
      for (const document of documents) {
        expect(document.title.trim().length).toBeGreaterThan(0);
        expect(document.sections.at(-1)?.heading.length).toBeGreaterThan(0);
        for (const section of document.sections) {
          expect(section.paragraphs.length).toBeGreaterThan(0);
          expect(section.paragraphs.every((paragraph) => paragraph.trim().length > 0)).toBe(true);
        }
      }
    }
  });
});

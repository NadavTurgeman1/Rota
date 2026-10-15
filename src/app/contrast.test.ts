import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const SURFACES = ["page", "paper", "card", "well"];
const BOARD = ["slot-m", "slot-a", "slot-n", "chip"];

/** Every text colour the components put on each background. */
const TEXT: [string, string[]][] = [
  ["ink", [...SURFACES, "well-strong", "brand-soft", ...BOARD]],
  ["ink-soft", [...SURFACES, ...BOARD]],
  ["muted", [...SURFACES, "brand-soft", "track", ...BOARD]],
  ["subtle", [...SURFACES, "well-strong", ...BOARD]],
  ["brand-text", ["brand-soft", "card", "page", ...BOARD]],
  ["on-brand", ["brand", "brand-hover"]],
  ["ok-text", ["ok-soft", "ok-softer", "card"]],
  ["danger-text", ["danger-soft", "danger-softer", "card", "page", ...BOARD]],
  ["warn-text", ["warn-soft", "warn-softer", "warn-softest", "card", "page"]],
  ["violet-text", ["violet-soft", "card"]],
  ["violet-strong", ["violet-softer"]],
];

/** Boundaries that identify a control: field borders, the focus ring, primary fills and checkbox fills. */
const UI: [string, string[]][] = [
  ["field-line", ["card", "page", "paper", "slot-m", "slot-a", "slot-n"]],
  ["focus", ["card", "page", "paper"]],
  ["brand", ["card", "page"]],
];

describe.each([
  ["light", ":root"],
  ["dark", ":root.dark"],
])("%s theme contrast", (_name, selector) => {
  const theme = tokens(selector);

  it.each(TEXT.flatMap(([fg, bgs]) => bgs.map((bg) => [fg, bg] as const)))("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(theme[fg], fg).toBeDefined();
    expect(theme[bg], bg).toBeDefined();
    expect(ratio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI.flatMap(([fg, bgs]) => bgs.map((bg) => [fg, bg] as const)))("control %s on %s is at least 3:1", (fg, bg) => {
    expect(ratio(theme[fg], theme[bg])).toBeGreaterThanOrEqual(3);
  });

  it("keeps dark surfaces off pure black and dark text off pure white", () => {
    if (selector === ":root.dark") {
      for (const surface of SURFACES) expect(theme[surface].toLowerCase()).not.toBe("#000000");
      expect(ratio(theme.ink, theme.page)).toBeGreaterThanOrEqual(15);
    } else {
      expect(ratio(theme.ink, theme.card)).toBeGreaterThanOrEqual(15);
    }
  });
});

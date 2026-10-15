import { formatReason, type Lang, type Reason } from "../domain";

export const MAX_EXPLANATION = 280;

export interface ExplainRequest {
  lang: Lang;
  name: string;
  /** Seat being covered, e.g. "רביעי · לילה". */
  seat: string;
  reason: Reason;
}

export interface Explanation {
  text: string;
  source: "model" | "rules";
}

const CODES = new Set<Reason["code"]>([
  "inactive",
  "agreement",
  "role",
  "unavailable",
  "overlap",
  "rest",
  "weekly_hours",
  "daily_hours",
  "weekly_shifts",
]);

export function readExplainRequest(body: unknown): ExplainRequest | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  if (input.lang !== "he" && input.lang !== "en") return null;
  if (typeof input.name !== "string" || typeof input.seat !== "string") return null;
  const reason = input.reason as Record<string, unknown> | null;
  if (!reason || typeof reason !== "object" || !CODES.has(reason.code as Reason["code"])) return null;
  for (const value of Object.values(reason)) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (typeof value === "string" && value.length > 80) return null;
  }
  return { lang: input.lang, name: input.name.slice(0, 80), seat: input.seat.slice(0, 80), reason: reason as unknown as Reason };
}

export function ruleText(request: ExplainRequest): string {
  return formatReason(request.reason, request.lang);
}

export function explainPrompt(request: ExplainRequest): { system: string; user: string } {
  const language = request.lang === "he" ? "Hebrew" : "English";
  const system = [
    `Rewrite one scheduling rule result as one or two short, plain ${language} sentences for a shift manager.`,
    "Use only the facts given. Do not add numbers, times, names, or advice that are not in the facts.",
    "Do not suggest breaking the rule. Return the sentences only, without quotes.",
  ].join("\n");
  const user = JSON.stringify({ employee: request.name, seat: request.seat, rule: request.reason, ruleText: ruleText(request) });
  return { system, user };
}

function numbersIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

/** The model may rephrase. It may not invent a fact, so every number must already be in the inputs. */
export function readExplanation(output: string, request: ExplainRequest): Explanation {
  const fallback: Explanation = { text: ruleText(request), source: "rules" };
  const text = output.trim().replace(/^["'״]+|["'״]+$/g, "").replace(/\s+/g, " ");
  if (!text || text.length > MAX_EXPLANATION) return fallback;
  const allowed = new Set([
    ...numbersIn(ruleText(request)),
    ...numbersIn(request.name),
    ...numbersIn(request.seat),
    ...Object.values(request.reason).flatMap((value) => numbersIn(String(value))),
  ]);
  if (numbersIn(text).some((value) => !allowed.has(value))) return fallback;
  return { text, source: "model" };
}

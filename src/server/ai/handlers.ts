import {
  constraintPrompt,
  readConstraintAnswer,
  readConstraintRequest,
  requestState,
  type ConstraintAnswer,
} from "../../ai/constraints";
import { explainPrompt, readExplainRequest, readExplanation, ruleText, type Explanation } from "../../ai/explain";
import { recordAi, type AiLogEntry } from "./log";
import type { ProviderStatus } from "./provider";

export type HandlerResult<T> = { status: number; body: T | { error: string } };

type Log = (entry: AiLogEntry) => void;

export function statusBody(status: ProviderStatus): { enabled: boolean } {
  return { enabled: status.enabled };
}

export async function handleConstraints(
  body: unknown,
  status: ProviderStatus,
  log: Log = (entry) => recordAi(entry),
  now: () => number = Date.now,
): Promise<HandlerResult<ConstraintAnswer>> {
  if (!status.enabled) return { status: 503, body: { error: "ai_disabled" } };
  const request = readConstraintRequest(body);
  if (!request) return { status: 400, body: { error: "bad_request" } };
  const prompt = constraintPrompt(request);
  const started = now();
  const textLines = request.text.split(/\r?\n/);
  const input = request.lines.map((line) => `${line}: ${textLines[line - 1] ?? ""}`);
  let output = "";
  try {
    output = await status.provider.complete({ ...prompt, json: true });
  } catch (error) {
    log({
      at: new Date(started).toISOString(),
      task: "constraints",
      provider: status.provider.name,
      model: status.provider.model,
      ms: now() - started,
      ok: false,
      input,
      output: "",
      kept: 0,
      dropped: 0,
      error: error instanceof Error ? error.message : "provider_error",
    });
    return { status: 502, body: { error: "provider_error" } };
  }
  const answer = readConstraintAnswer(output, request, requestState(request));
  log({
    at: new Date(started).toISOString(),
    task: "constraints",
    provider: status.provider.name,
    model: status.provider.model,
    ms: now() - started,
    ok: true,
    input,
    output,
    kept: answer.suggestions.length,
    dropped: answer.dropped.length,
  });
  return { status: 200, body: answer };
}

export async function handleExplain(
  body: unknown,
  status: ProviderStatus,
  log: Log = (entry) => recordAi(entry),
  now: () => number = Date.now,
): Promise<HandlerResult<Explanation>> {
  const request = readExplainRequest(body);
  if (!request) return { status: 400, body: { error: "bad_request" } };
  if (!status.enabled) return { status: 200, body: { text: ruleText(request), source: "rules" } };
  const started = now();
  let output = "";
  let error: string | undefined;
  try {
    output = await status.provider.complete({ ...explainPrompt(request), json: false });
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "provider_error";
  }
  const explanation = error ? { text: ruleText(request), source: "rules" as const } : readExplanation(output, request);
  log({
    at: new Date(started).toISOString(),
    task: "explain",
    provider: status.provider.name,
    model: status.provider.model,
    ms: now() - started,
    ok: !error,
    input: [request.reason.code],
    output,
    kept: explanation.source === "model" ? 1 : 0,
    dropped: explanation.source === "model" ? 0 : 1,
    ...(error ? { error } : {}),
  });
  return { status: 200, body: explanation };
}

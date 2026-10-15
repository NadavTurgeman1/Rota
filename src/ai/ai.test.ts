import { describe, expect, it } from "vitest";
import { SENTINEL, sentinelState } from "../demo/sentinel";
import type { Employee, RotaState } from "../domain";
import { applyConstraintText, MANAGER } from "../people/edit";
import { parseConstraints } from "../parser";
import { handleConstraints, handleExplain } from "../server/ai/handlers";
import type { AiLogEntry } from "../server/ai/log";
import { anthropicProvider, openAiProvider, providerFromEnv, type ModelProvider, type ProviderStatus } from "../server/ai/provider";
import { constraintRequest } from "./constraints";

const week = "2026-10-11";
const { morning, afternoon, night } = SENTINEL;
const messy = "בן נתנוב\nיום שלישי אין מצב בלילה, יש לי מילואים\nתודה";

function guard(id: string, name: string): Employee {
  return {
    id,
    name,
    contact: `${id}@example.com`,
    role: "Guard",
    quals: "",
    perWeek: 5,
    maxHours: 0,
    pref: [],
    active: true,
    grid: [0, 1, 2, 3, 4, 5, 6].map(() => [morning, afternoon, night]),
  };
}

function demo(): RotaState {
  const state = sentinelState(week);
  state.emps = [guard("ben", "בן נתנוב"), guard("yossi", "Yossi")];
  return state;
}

function fake(output: string | Error): { status: ProviderStatus; calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  const provider: ModelProvider = {
    name: "fake",
    model: "fake-1",
    async complete(input) {
      calls.push(input);
      if (output instanceof Error) throw output;
      return output;
    },
  };
  return { status: { enabled: true, provider }, calls };
}

describe("model suggestions for lines the rules left open", () => {
  it("turns a messy line into a suggestion the manager can approve", async () => {
    const state = demo();
    const draft = parseConstraints(messy, state);
    expect(draft.lines[1]).toMatchObject({ status: "ambiguous", reason: "missing_polarity" });
    expect(draft.proposals).toEqual({});

    const request = constraintRequest(state, draft, "he")!;
    expect(request.lines).toEqual([2, 3]);
    expect(JSON.stringify(request)).not.toContain("@example.com");

    const { status, calls } = fake(
      JSON.stringify({ suggestions: [{ line: 2, employeeId: "ben", days: [2], shiftIds: [night], polarity: "off" }] }),
    );
    const log: AiLogEntry[] = [];
    const result = await handleConstraints(request, status, (entry) => log.push(entry));
    expect(result.status).toBe(200);
    const answer = result.body as { suggestions: unknown[]; dropped: unknown[] };
    expect(answer.suggestions).toEqual([{ line: 2, employeeId: "ben", days: [2], shiftIds: [night], allShifts: false, polarity: "off" }]);
    expect(calls[0].user).toContain("2: יום שלישי אין מצב בלילה");
    expect(log[0]).toMatchObject({ task: "constraints", ok: true, kept: 1, dropped: 0 });
    expect(log[0].input).toEqual(["2: יום שלישי אין מצב בלילה, יש לי מילואים", "3: תודה"]);

    const accepted = parseConstraints(messy, state, answer.suggestions as never);
    expect(accepted.lines[1]).toMatchObject({ status: "recognized", source: "model" });
    expect(accepted.proposals.ben[2]).toEqual([morning, afternoon]);
    expect(state.avail[week]).toBeUndefined();

    const approved = applyConstraintText(state, MANAGER, messy, answer.suggestions as never);
    expect(approved.avail[week].ben[2]).toEqual([morning, afternoon]);
    expect(approved.notes).toBeUndefined();
    expect(approved.emps[0].grid).toEqual(state.emps[0].grid);

    expect(applyConstraintText(state, MANAGER, messy)).toBe(state);
  });

  it("drops invented people, shifts, days, and lines that were not asked about", async () => {
    const state = demo();
    const request = constraintRequest(state, parseConstraints(messy, state), "he")!;
    const { status } = fake(
      [
        "Sure! Here you go:",
        JSON.stringify({
          suggestions: [
            { line: 2, employeeId: "moshe", days: [2], shiftIds: [night], polarity: "off" },
            { line: 2, employeeId: "ben", days: [9], shiftIds: [night], polarity: "off" },
            { line: 2, employeeId: "ben", days: [2], shiftIds: ["swing"], polarity: "off" },
            { line: 2, employeeId: "ben", days: [2], shiftIds: [], polarity: "only" },
            { line: 1, employeeId: "ben", days: [0], shiftIds: [morning], polarity: "off" },
            { line: 2, employeeId: "ben", days: [2], shiftIds: [night], polarity: "assign" },
          ],
        }),
      ].join("\n"),
    );
    const result = await handleConstraints(request, status, () => undefined);
    const answer = result.body as { suggestions: unknown[]; dropped: { why: string }[] };
    expect(answer.suggestions).toEqual([]);
    expect(answer.dropped.map((item) => item.why)).toEqual([
      "unknown_employee",
      "bad_shape",
      "bad_shape",
      "bad_shape",
      "line_not_requested",
      "bad_shape",
    ]);
  });

  it("keeps a suggestion off a line the rules already recognized", () => {
    const state = demo();
    const text = "בן נתנוב\nראשון - לא עובד בוקר";
    const draft = parseConstraints(text, state, [
      { line: 2, employeeId: "yossi", days: [0], shiftIds: [morning], allShifts: false, polarity: "off" },
    ]);
    expect(draft.lines[1]).toMatchObject({ employeeId: "ben", status: "recognized" });
    expect(draft.lines[1].source).not.toBe("model");
    expect(draft.proposals.yossi).toBeUndefined();
  });

  it("leaves the parser and the approval path working when the model is off or broken", async () => {
    const state = demo();
    const request = constraintRequest(state, parseConstraints(messy, state), "he")!;
    expect(await handleConstraints(request, { enabled: false, why: "no_key" })).toEqual({ status: 503, body: { error: "ai_disabled" } });

    const log: AiLogEntry[] = [];
    const broken = await handleConstraints(request, fake(new Error("provider_http_500")).status, (entry) => log.push(entry));
    expect(broken).toEqual({ status: 502, body: { error: "provider_error" } });
    expect(log[0]).toMatchObject({ ok: false, error: "provider_http_500" });

    const garbage = await handleConstraints(request, fake("not json").status, () => undefined);
    expect(garbage.body).toEqual({ suggestions: [], dropped: [] });

    expect(await handleConstraints({ lang: "he", text: "x", lines: [5] }, fake("{}").status, () => undefined)).toEqual({
      status: 400,
      body: { error: "bad_request" },
    });

    const plain = applyConstraintText(state, MANAGER, "בן נתנוב\nשלישי - לא עובד לילה");
    expect(plain.avail[week].ben[2]).toEqual([morning, afternoon]);
  });
});

describe("plain explanations of a ruled-out replacement", () => {
  const request = {
    lang: "he" as const,
    name: "Omer",
    seat: "רביעי · לילה",
    reason: { code: "rest" as const, hours: 8, label: "Tuesday Night" },
  };

  it("uses the model text when it keeps to the facts", async () => {
    const result = await handleExplain(request, fake("Omer סיים לילה 8 שעות לפני, וזה פחות מהמנוחה הנדרשת.").status, () => undefined);
    expect(result.body).toEqual({ text: "Omer סיים לילה 8 שעות לפני, וזה פחות מהמנוחה הנדרשת.", source: "model" });
  });

  it("falls back to the rule text when the model invents a number, fails, or is off", async () => {
    const invented = await handleExplain(request, fake("Omer נח רק 6 שעות.").status, () => undefined);
    expect(invented.body).toMatchObject({ source: "rules" });
    expect((invented.body as { text: string }).text).toContain("8");

    const failed = await handleExplain(request, fake(new Error("timeout")).status, () => undefined);
    expect(failed.body).toMatchObject({ source: "rules" });

    const off = await handleExplain(request, { enabled: false, why: "no_key" }, () => undefined);
    expect(off.body).toMatchObject({ source: "rules" });

    expect((await handleExplain({ ...request, reason: { code: "assign" } }, fake("x").status, () => undefined)).status).toBe(400);
  });
});

describe("provider configuration", () => {
  it("needs a key and an explicit model, and can be switched off", () => {
    expect(providerFromEnv({})).toEqual({ enabled: false, why: "no_key" });
    expect(providerFromEnv({ OPENAI_API_KEY: "sk-test" })).toEqual({ enabled: false, why: "no_model" });
    expect(providerFromEnv({ OPENAI_API_KEY: "sk-test", ROTA_AI_MODEL: "m", ROTA_AI_PROVIDER: "off" })).toEqual({ enabled: false, why: "off" });
    const anthropic = providerFromEnv({ OPENAI_API_KEY: "sk", ANTHROPIC_API_KEY: "ak", ROTA_AI_MODEL: "m", ROTA_AI_PROVIDER: "anthropic" });
    expect(anthropic.enabled && anthropic.provider.name).toBe("anthropic");
  });

  it("sends the key in a header and the prompt in the body", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      const body = url.includes("anthropic")
        ? { content: [{ type: "text", text: "ok-a" }] }
        : { choices: [{ message: { content: "ok-o" } }] };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;

    expect(await openAiProvider("sk-secret", "model-o", fetcher).complete({ system: "s", user: "u", json: true })).toBe("ok-o");
    expect(await anthropicProvider("ak-secret", "model-a", fetcher).complete({ system: "s", user: "u", json: true })).toBe("ok-a");

    const [openai, claude] = seen;
    expect((openai.init.headers as Record<string, string>).authorization).toBe("Bearer sk-secret");
    expect(String(openai.init.body)).not.toContain("sk-secret");
    expect(JSON.parse(String(openai.init.body))).toMatchObject({ model: "model-o", response_format: { type: "json_object" } });
    expect((claude.init.headers as Record<string, string>)["x-api-key"]).toBe("ak-secret");
    expect(String(claude.init.body)).not.toContain("ak-secret");

    const failing = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    await expect(openAiProvider("k", "m", failing).complete({ system: "s", user: "u", json: false })).rejects.toThrow("provider_http_401");
  });
});

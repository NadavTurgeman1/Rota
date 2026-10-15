/** Server only. Keys come from the environment and never leave this module. */

export interface ModelProvider {
  name: string;
  model: string;
  complete(input: { system: string; user: string; json: boolean }): Promise<string>;
}

export type ProviderStatus =
  | { enabled: true; provider: ModelProvider }
  | { enabled: false; why: "no_key" | "no_model" | "off" };

type Fetch = typeof fetch;

const TIMEOUT_MS = 20_000;

async function post(fetcher: Fetch, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetcher(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`provider_http_${response.status}`);
  return response.json();
}

export function openAiProvider(key: string, model: string, fetcher: Fetch = fetch, baseUrl = "https://api.openai.com/v1"): ModelProvider {
  return {
    name: "openai",
    model,
    async complete({ system, user, json }) {
      const data = (await post(
        fetcher,
        `${baseUrl}/chat/completions`,
        { authorization: `Bearer ${key}` },
        {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          ...(json ? { response_format: { type: "json_object" } } : {}),
        },
      )) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content ?? "";
    },
  };
}

export function anthropicProvider(key: string, model: string, fetcher: Fetch = fetch): ModelProvider {
  return {
    name: "anthropic",
    model,
    async complete({ system, user }) {
      const data = (await post(
        fetcher,
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        { model, max_tokens: 1024, system, messages: [{ role: "user", content: user }] },
      )) as { content?: { type: string; text?: string }[] };
      return (data.content ?? [])
        .filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("");
    },
  };
}

/**
 * `ROTA_AI_PROVIDER` picks `openai` or `anthropic`, otherwise the first key found wins.
 * `ROTA_AI_MODEL` is required, so a model name is never guessed. `ROTA_AI_PROVIDER=off` disables the layer.
 */
export function providerFromEnv(env: Record<string, string | undefined> = process.env, fetcher: Fetch = fetch): ProviderStatus {
  const choice = env.ROTA_AI_PROVIDER?.trim().toLowerCase();
  if (choice === "off") return { enabled: false, why: "off" };
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const anthropicKey = env.ANTHROPIC_API_KEY?.trim();
  const name = choice === "openai" || choice === "anthropic" ? choice : openaiKey ? "openai" : anthropicKey ? "anthropic" : null;
  const key = name === "openai" ? openaiKey : name === "anthropic" ? anthropicKey : undefined;
  if (!name || !key) return { enabled: false, why: "no_key" };
  const model = env.ROTA_AI_MODEL?.trim();
  if (!model) return { enabled: false, why: "no_model" };
  return {
    enabled: true,
    provider: name === "openai" ? openAiProvider(key, model, fetcher, env.OPENAI_BASE_URL?.trim() || undefined) : anthropicProvider(key, model, fetcher),
  };
}

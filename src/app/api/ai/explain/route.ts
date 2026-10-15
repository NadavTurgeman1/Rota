import { aiGuard } from "../../../../server/ai/guard";
import { handleExplain } from "../../../../server/ai/handlers";
import { providerFromEnv } from "../../../../server/ai/provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await aiGuard(request);
  if (denied) return denied;
  const raw = await request.text();
  if (raw.length > 4000) return Response.json({ error: "too_large" }, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await handleExplain(body, providerFromEnv());
  return Response.json(result.body, { status: result.status });
}

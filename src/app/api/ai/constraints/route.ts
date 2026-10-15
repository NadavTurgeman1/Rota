import { MAX_TEXT } from "../../../../ai/constraints";
import { aiGuard } from "../../../../server/ai/guard";
import { handleConstraints } from "../../../../server/ai/handlers";
import { providerFromEnv } from "../../../../server/ai/provider";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = await aiGuard(request);
  if (denied) return denied;
  const raw = await request.text();
  if (raw.length > MAX_TEXT * 4) return Response.json({ error: "too_large" }, { status: 413 });
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const result = await handleConstraints(body, providerFromEnv());
  return Response.json(result.body, { status: result.status });
}

import { statusBody } from "../../../../server/ai/handlers";
import { providerFromEnv } from "../../../../server/ai/provider";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(statusBody(providerFromEnv()));
}

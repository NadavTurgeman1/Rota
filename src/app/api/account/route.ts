import { deleteSignedInAccount } from "../../../db/account-delete";
import { SaveError } from "../../../db/save";
import { RequestClosed, withDatabase } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { scope?: unknown; orgId?: unknown; orgName?: unknown } | null;
  const scope = body?.scope === "business" ? "business" : body?.scope === "login" ? "login" : null;
  if (!scope) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    const decision = await withDatabase(
      (sql) =>
        deleteSignedInAccount(sql, userId, {
          scope,
          orgId: typeof body?.orgId === "string" ? body.orgId : "",
          confirmedName: typeof body?.orgName === "string" ? body.orgName : "",
        }),
      request.signal,
    );
    if (!decision.ok) return Response.json({ error: decision.reason }, { status: decision.reason === "name" ? 400 : 403 });
    return Response.json({ deleted: true });
  } catch (error) {
    if (error instanceof RequestClosed) return new Response(null, { status: 499 });
    if (error instanceof SaveError && error.message === "db_unconfigured") {
      return Response.json({ error: "db_unconfigured" }, { status: 503 });
    }
    console.error(error instanceof Error ? error.message : "account delete failed");
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
}

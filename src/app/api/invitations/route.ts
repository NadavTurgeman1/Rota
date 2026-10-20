import { inviteShiftManager, removeShiftManager, setShiftManagerSites } from "../../../db/workspace-store";
import { SaveError } from "../../../db/save";
import type { SqlClient } from "../../../db/types";
import { supportOrgFrom, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

interface Body {
  orgId: string;
  siteIds: string[];
  fullName: string;
  email: string;
}

async function handle(request: Request, run: (sql: SqlClient, body: Body) => Promise<void>): Promise<Response> {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const body: Body = {
    orgId: typeof raw?.orgId === "string" ? raw.orgId : "",
    siteIds: Array.isArray(raw?.siteIds) ? raw.siteIds.filter((siteId): siteId is string => typeof siteId === "string") : [],
    fullName: typeof raw?.fullName === "string" ? raw.fullName : "",
    email: typeof raw?.email === "string" ? raw.email : "",
  };
  try {
    await withUserDb(userId, (sql) => run(sql, body), supportOrgFrom(request));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof SaveError && error.message === "forbidden") {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error instanceof Error ? error.message : "invitation request failed");
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handle(request, (sql, body) => inviteShiftManager(sql, body));
}

/** The owner changes which sites a shift manager runs. */
export async function PATCH(request: Request) {
  return handle(request, (sql, body) => setShiftManagerSites(sql, body));
}

/** The owner removes a shift manager from the business. */
export async function DELETE(request: Request) {
  return handle(request, (sql, body) => removeShiftManager(sql, body));
}

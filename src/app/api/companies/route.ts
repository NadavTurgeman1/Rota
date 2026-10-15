import { approveSignupEmail, listFounderApprovals, listTenants, setTenantStatus } from "../../../db/workspace-store";
import { SaveError } from "../../../db/save";
import { withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const listed = await withUserDb(userId, async (sql) => ({
      companies: await listTenants(sql),
      approvals: await listFounderApprovals(sql),
    }));
    return Response.json(listed);
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    type?: unknown;
    fullName?: unknown;
    email?: unknown;
    id?: unknown;
    status?: unknown;
  } | null;
  try {
    if (body?.status === "active" || body?.status === "suspended") {
      const id = typeof body.id === "string" ? body.id : "";
      await withUserDb(userId, (sql) => setTenantStatus(sql, { id, status: body.status as "active" | "suspended" }));
    } else {
      const email = typeof body?.email === "string" ? body.email : "";
      await withUserDb(userId, (sql) => approveSignupEmail(sql, email));
    }
    const listed = await withUserDb(userId, async (sql) => ({
      companies: await listTenants(sql),
      approvals: await listFounderApprovals(sql),
    }));
    return Response.json(listed);
  } catch (error) {
    return failed(error);
  }
}

function failed(error: unknown): Response {
  if (error instanceof SaveError && error.message === "forbidden") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error instanceof Error ? error.message : "company request failed");
  return Response.json({ error: "save_failed" }, { status: 500 });
}

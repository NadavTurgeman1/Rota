import { approveFounder, listFounderApprovals } from "../../../db/workspace-store";
import { SaveError } from "../../../db/save";
import { withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const approvals = await withUserDb(userId, (sql) => listFounderApprovals(sql));
    return Response.json({ approvals });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { fullName?: unknown; email?: unknown } | null;
  const fullName = typeof body?.fullName === "string" ? body.fullName : "";
  const email = typeof body?.email === "string" ? body.email : "";
  try {
    await withUserDb(userId, (sql) => approveFounder(sql, { fullName, email }));
    const approvals = await withUserDb(userId, (sql) => listFounderApprovals(sql));
    return Response.json({ approvals });
  } catch (error) {
    return failed(error);
  }
}

function failed(error: unknown): Response {
  if (error instanceof SaveError && error.message === "forbidden") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error instanceof Error ? error.message : "approval request failed");
  return Response.json({ error: "save_failed" }, { status: 500 });
}

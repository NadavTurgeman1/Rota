import { listTenants, provisionCompany, setTenantStatus } from "../../../db/workspace-store";
import { SaveError } from "../../../db/save";
import { withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const companies = await withUserDb(userId, (sql) => listTenants(sql));
    return Response.json({ companies });
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
      const name = typeof body?.name === "string" ? body.name : "";
      const type = typeof body?.type === "string" ? body.type : "";
      const fullName = typeof body?.fullName === "string" ? body.fullName : "";
      const email = typeof body?.email === "string" ? body.email : "";
      await withUserDb(userId, (sql) => provisionCompany(sql, { name, type, fullName, email }));
    }
    const companies = await withUserDb(userId, (sql) => listTenants(sql));
    return Response.json({ companies });
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

import { inviteStaffLogin, openPerson, removeStaffLogin } from "../../../db/workspace-store";
import { SaveError } from "../../../db/save";
import { supportOrgFrom, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    orgId?: unknown;
    employeeId?: unknown;
    email?: unknown;
    id?: unknown;
    name?: unknown;
    phone?: unknown;
    schedulable?: unknown;
    capabilities?: unknown;
    workSiteId?: unknown;
    managedSiteIds?: unknown;
  } | null;
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  const email = typeof body?.email === "string" ? body.email : "";
  try {
    if (typeof body?.name === "string" && typeof body.id === "string") {
      const capabilities =
        body.capabilities && typeof body.capabilities === "object" ? (body.capabilities as Record<string, boolean>) : {};
      const managedSiteIds = Array.isArray(body.managedSiteIds)
        ? body.managedSiteIds.filter((item): item is string => typeof item === "string")
        : [];
      const status = await withUserDb(
        userId,
        (sql) =>
          openPerson(sql, {
            orgId,
            id: body.id as string,
            name: body.name as string,
            phone: typeof body.phone === "string" ? body.phone : "",
            email,
            schedulable: body.schedulable !== false,
            capabilities,
            workSiteId: typeof body.workSiteId === "string" ? body.workSiteId : null,
            managedSiteIds,
          }),
        supportOrgFrom(request),
      );
      return Response.json({ ok: true, status });
    }
    const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
    const status = await withUserDb(
      userId,
      (sql) => inviteStaffLogin(sql, { orgId, employeeId, email }),
      supportOrgFrom(request),
    );
    return Response.json({ ok: true, status });
  } catch (error) {
    if (error instanceof SaveError && error.message === "forbidden") {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error instanceof Error ? error.message : "staff invitation failed");
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
}

/** An owner or shift manager removes an employee login. The roster person stays. */
export async function DELETE(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { orgId?: unknown; employeeId?: unknown } | null;
  const orgId = typeof body?.orgId === "string" ? body.orgId : "";
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
  try {
    await withUserDb(userId, (sql) => removeStaffLogin(sql, { orgId, employeeId }), supportOrgFrom(request));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof SaveError && error.message === "forbidden") {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error instanceof Error ? error.message : "staff login removal failed");
    return Response.json({ error: "save_failed" }, { status: 500 });
  }
}

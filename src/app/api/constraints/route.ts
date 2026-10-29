import { clearClosedConstraintGrants, closeConstraintExtension, openConstraintExtension, saveConstraintGrant } from "../../../db/constraints";
import { SaveError } from "../../../db/save";
import { supportOrgFrom, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

function statusFor(error: unknown): Response {
  if (error instanceof SaveError && (error.message === "forbidden" || error.message === "window" || error.message === "availability")) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error instanceof Error ? error.message : "constraint settings failed");
  return Response.json({ error: "save_failed" }, { status: 500 });
}

/** A manager allows one employee to ignore the block cap for one week. */
export async function PUT(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    siteId?: unknown;
    employeeId?: unknown;
    week?: unknown;
    allowed?: unknown;
  } | null;
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
  const week = typeof body?.week === "string" ? body.week : "";
  if (!siteId || !employeeId || !week || typeof body?.allowed !== "boolean") {
    return Response.json({ error: "availability" }, { status: 400 });
  }
  try {
    await withUserDb(
      userId,
      (sql) => saveConstraintGrant(sql, { siteId, employeeId, week, allowed: body.allowed === true }),
      supportOrgFrom(request),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return statusFor(error);
  }
}

/** Open or close the extra submission window. `minutes` of null closes it. */
export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { siteId?: unknown; minutes?: unknown; settle?: unknown } | null;
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  if (!siteId) return Response.json({ error: "window" }, { status: 400 });
  try {
    if (body?.settle === true) {
      await withUserDb(userId, (sql) => clearClosedConstraintGrants(sql, siteId), supportOrgFrom(request));
      return Response.json({ ok: true });
    }
    if (body?.minutes === null) {
      await withUserDb(userId, (sql) => closeConstraintExtension(sql, siteId), supportOrgFrom(request));
      return Response.json({ ok: true, until: null });
    }
    const minutes = typeof body?.minutes === "number" ? body.minutes : Number.NaN;
    const until = await withUserDb(userId, (sql) => openConstraintExtension(sql, { siteId, minutes }), supportOrgFrom(request));
    return Response.json({ ok: true, until });
  } catch (error) {
    return statusFor(error);
  }
}

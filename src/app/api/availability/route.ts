import { acknowledgeAvailabilityRequest, decideAvailabilityRequest, submitAvailabilityRequest } from "../../../db/availability";
import { SaveError } from "../../../db/save";
import { supportOrgFrom, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

function gridFrom(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length !== 7) return null;
  return value.map((day) => (Array.isArray(day) ? day.filter((id): id is string => typeof id === "string") : []));
}

function statusFor(error: unknown): Response {
  if (error instanceof SaveError && (error.message === "forbidden" || error.message === "window" || error.message === "blocks" || error.message === "same")) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error instanceof Error ? error.message : "availability request failed");
  return Response.json({ error: "save_failed" }, { status: 500 });
}

/** The employee submits a request. Official constraints stay unchanged. */
export async function PUT(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    siteId?: unknown;
    week?: unknown;
    shifts?: unknown;
  } | null;
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const week = typeof body?.week === "string" ? body.week : "";
  const shifts = gridFrom(body?.shifts);
  if (!siteId || !week || !shifts) return Response.json({ error: "availability" }, { status: 400 });
  try {
    const stored = await withUserDb(
      userId,
      (sql) => submitAvailabilityRequest(sql, { siteId, week, shifts }),
      supportOrgFrom(request),
    );
    return Response.json({ ok: true, request: stored });
  } catch (error) {
    return statusFor(error);
  }
}

/** A shift manager approves the request into the weekly constraints, or rejects it. */
export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { requestId?: unknown; approve?: unknown } | null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  if (!requestId || typeof body?.approve !== "boolean") return Response.json({ error: "availability" }, { status: 400 });
  try {
    const stored = await withUserDb(
      userId,
      (sql) => decideAvailabilityRequest(sql, { requestId, approve: body.approve === true }),
      supportOrgFrom(request),
    );
    return Response.json({ ok: true, approve: body.approve === true, request: stored });
  } catch (error) {
    return statusFor(error);
  }
}

/** The employee dismisses the notice after they have seen the answer. */
export async function PATCH(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { requestId?: unknown } | null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  if (!requestId) return Response.json({ error: "availability" }, { status: 400 });
  try {
    await withUserDb(userId, (sql) => acknowledgeAvailabilityRequest(sql, requestId), supportOrgFrom(request));
    return Response.json({ ok: true });
  } catch (error) {
    return statusFor(error);
  }
}

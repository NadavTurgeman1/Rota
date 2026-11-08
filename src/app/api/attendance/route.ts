import { correctAttendance, loadEmployeeAttendance, loadOwnAttendance, loadRosterAttendance, recordAttendancePunch } from "../../../db/attendance";
import { SaveError } from "../../../db/save";
import { RequestClosed, supportOrgFrom, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function failed(error: unknown): Response {
  if (error instanceof RequestClosed) return new Response(null, { status: 499 });
  if (error instanceof SaveError) {
    const status = error.message === "forbidden" ? 403 : error.message === "db_unconfigured" ? 503 : 409;
    return Response.json({ error: error.message }, { status });
  }
  console.error(error instanceof Error ? error.message : "attendance request failed");
  return Response.json({ error: "attendance" }, { status: 500 });
}

/** The signed-in employee's clock, or one employee's log for an owner or shift manager. */
export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const siteId = url.searchParams.get("siteId") ?? "";
  const employeeId = url.searchParams.get("employeeId") ?? "";
  const roster = url.searchParams.get("roster") === "1";
  if (!UUID.test(siteId) && !UUID.test(employeeId)) return Response.json({ error: "forbidden" }, { status: 400 });
  if (roster && !UUID.test(siteId)) return Response.json({ error: "forbidden" }, { status: 400 });
  try {
    const body = await withUserDb(
      userId,
      async (sql) => {
        if (roster && UUID.test(siteId)) {
          const from = url.searchParams.get("from") ?? "";
          const to = url.searchParams.get("to") ?? "";
          const range = DAY.test(from) && DAY.test(to) && from <= to ? { from, to } : undefined;
          return loadRosterAttendance(sql, siteId, range);
        }
        if (UUID.test(employeeId)) return loadEmployeeAttendance(sql, employeeId);
        return loadOwnAttendance(sql, siteId);
      },
      supportOrgFrom(request),
      request.signal,
    );
    return Response.json(body);
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const kind = body?.kind === "out" ? "out" : body?.kind === "in" ? "in" : "";
  const deviceAt = typeof body?.deviceAt === "string" ? body.deviceAt : "";
  const deviceOffsetMinutes = typeof body?.deviceOffsetMinutes === "number" ? body.deviceOffsetMinutes : Number.NaN;
  const latitude = typeof body?.latitude === "number" ? body.latitude : Number.NaN;
  const longitude = typeof body?.longitude === "number" ? body.longitude : Number.NaN;
  const accuracyMeters = typeof body?.accuracyMeters === "number" ? body.accuracyMeters : Number.NaN;
  if (!UUID.test(siteId) || !kind || !Number.isFinite(deviceOffsetMinutes) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(accuracyMeters)) {
    return Response.json({ error: "attendance" }, { status: 400 });
  }
  try {
    const snapshot = await withUserDb(
      userId,
      async (sql) => {
        await recordAttendancePunch(sql, { siteId, kind, deviceAt, deviceOffsetMinutes, latitude, longitude, accuracyMeters });
        return loadOwnAttendance(sql, siteId);
      },
      supportOrgFrom(request),
      request.signal,
    );
    return Response.json(snapshot);
  } catch (error) {
    return failed(error);
  }
}

export async function PATCH(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
  const action = body?.action === "add" || body?.action === "adjust" || body?.action === "remove" ? body.action : "";
  const siteId = typeof body?.siteId === "string" ? body.siteId : null;
  const kind = body?.kind === "in" || body?.kind === "out" ? body.kind : null;
  const punchId = typeof body?.punchId === "string" ? body.punchId : null;
  const punchIdB = typeof body?.punchIdB === "string" ? body.punchIdB : null;
  const at = typeof body?.at === "string" ? body.at : null;
  if (!UUID.test(employeeId) || !action) return Response.json({ error: "attendance" }, { status: 400 });
  try {
    const snapshot = await withUserDb(
      userId,
      async (sql) => {
        await correctAttendance(sql, { employeeId, action, siteId, kind, punchId, punchIdB, at });
        return loadEmployeeAttendance(sql, employeeId);
      },
      supportOrgFrom(request),
      request.signal,
    );
    return Response.json(snapshot);
  } catch (error) {
    return failed(error);
  }
}

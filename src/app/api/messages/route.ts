import {
  acknowledgeManagerMessage,
  createManagerMessage,
  deleteManagerMessage,
  listManagerMessages,
  listStaffMessages,
  type MessageAudience,
  type MessageDeliver,
} from "../../../db/messages";
import { SaveError } from "../../../db/save";
import { RequestClosed, supportOrgFrom, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failed(error: unknown): Response {
  if (error instanceof RequestClosed) return new Response(null, { status: 499 });
  if (error instanceof SaveError) {
    const status = error.message === "forbidden" ? 403 : error.message === "db_unconfigured" ? 503 : 400;
    return Response.json({ error: error.message }, { status });
  }
  console.error(error instanceof Error ? error.message : "message request failed");
  return Response.json({ error: "messages" }, { status: 500 });
}

/** Manager list for a site, or the signed-in employee's due notes. */
export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const siteId = new URL(request.url).searchParams.get("siteId") ?? "";
  try {
    const messages = await withUserDb(
      userId,
      (sql) => (UUID.test(siteId) ? listManagerMessages(sql, siteId) : listStaffMessages(sql)),
      supportOrgFrom(request),
      request.signal,
    );
    return Response.json({ messages });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "create";
  const support = supportOrgFrom(request);
  try {
    if (action === "ack") {
      const messageId = typeof body?.messageId === "string" ? body.messageId : "";
      const kind = body?.kind === "popup" ? "popup" : body?.kind === "read" ? "read" : "";
      if (!UUID.test(messageId) || !kind) return Response.json({ error: "messages" }, { status: 400 });
      await withUserDb(userId, (sql) => acknowledgeManagerMessage(sql, messageId, kind), support, request.signal);
      return Response.json({ ok: true });
    }
    if (action === "create") {
      const siteId = typeof body?.siteId === "string" ? body.siteId : "";
      const text = typeof body?.body === "string" ? body.body : "";
      const audience = body?.audience as MessageAudience;
      const deliver = body?.deliver as MessageDeliver;
      const employeeIds = Array.isArray(body?.employeeIds) ? body.employeeIds.filter((id): id is string => typeof id === "string") : [];
      const at = typeof body?.at === "string" ? body.at : undefined;
      const week = typeof body?.week === "string" ? body.week : undefined;
      const shiftId = typeof body?.shiftId === "string" ? body.shiftId : undefined;
      const weekday = typeof body?.weekday === "number" ? body.weekday : undefined;
      const message = await withUserDb(
        userId,
        (sql) => createManagerMessage(sql, { siteId, body: text, audience, deliver, employeeIds, at, week, shiftId, weekday }),
        support,
        request.signal,
      );
      return Response.json({ message });
    }
    return Response.json({ error: "messages" }, { status: 400 });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const messageId = new URL(request.url).searchParams.get("messageId") ?? "";
  if (!UUID.test(messageId)) return Response.json({ error: "forbidden" }, { status: 400 });
  try {
    await withUserDb(userId, (sql) => deleteManagerMessage(sql, messageId), supportOrgFrom(request), request.signal);
    return Response.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}

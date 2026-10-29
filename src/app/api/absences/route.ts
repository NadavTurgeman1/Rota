import {
  deleteAbsenceRequest,
  createAbsenceRequest,
  decideAbsenceRequest,
  listAbsenceRequests,
  readAbsenceFile,
} from "../../../db/absences";
import { SaveError } from "../../../db/save";
import type { AbsenceKind } from "../../../domain/absence";
import { FORM_BYTE_LIMIT } from "../../../people/forms";
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
  console.error(error instanceof Error ? error.message : "absence request failed");
  return Response.json({ error: "absence" }, { status: 500 });
}

export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId") ?? "";
  const siteId = url.searchParams.get("siteId") ?? "";
  const support = supportOrgFrom(request);
  try {
    if (UUID.test(fileId)) {
      const opened = await withUserDb(userId, (sql) => readAbsenceFile(sql, fileId), support, request.signal);
      const ascii = opened.file.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
      return new Response(Buffer.from(opened.body), {
        headers: {
          "content-type": opened.file.type,
          "content-disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opened.file.name)}`,
          "cache-control": "private, no-store",
        },
      });
    }
    const requests = await withUserDb(
      userId,
      (sql) => listAbsenceRequests(sql, UUID.test(siteId) ? siteId : undefined),
      support,
      request.signal,
    );
    return Response.json({ requests });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const support = supportOrgFrom(request);
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData().catch(() => null);
      const siteId = typeof form?.get("siteId") === "string" ? String(form.get("siteId")) : "";
      const kind = (typeof form?.get("kind") === "string" ? String(form.get("kind")) : "") as AbsenceKind;
      const start = typeof form?.get("start") === "string" ? String(form.get("start")) : "";
      const end = typeof form?.get("end") === "string" ? String(form.get("end")) : "";
      const note = typeof form?.get("note") === "string" ? String(form.get("note")) : "";
      const employeeId = typeof form?.get("employeeId") === "string" ? String(form.get("employeeId")) : "";
      const files: { name: string; type: string; body: Uint8Array }[] = [];
      for (const item of form?.getAll("file") ?? []) {
        if (!(item instanceof File)) continue;
        if (item.size < 1 || item.size > FORM_BYTE_LIMIT) return Response.json({ error: "size" }, { status: 400 });
        files.push({ name: item.name, type: item.type, body: new Uint8Array(await item.arrayBuffer()) });
      }
      const saved = await withUserDb(
        userId,
        (sql) =>
          createAbsenceRequest(sql, {
            siteId,
            employeeId: UUID.test(employeeId) ? employeeId : undefined,
            kind,
            start,
            end,
            note,
            files,
          }),
        support,
        request.signal,
      );
      return Response.json({ request: saved });
    }
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const action = typeof body?.action === "string" ? body.action : "";
    const requestId = typeof body?.requestId === "string" ? body.requestId : "";
    if (!UUID.test(requestId)) return Response.json({ error: "absence" }, { status: 400 });
    if (action === "approve" || action === "reject") {
      await withUserDb(userId, (sql) => decideAbsenceRequest(sql, requestId, action === "approve"), support, request.signal);
      return Response.json({ ok: true });
    }
    if (action === "delete" || action === "cancel") {
      await withUserDb(userId, (sql) => deleteAbsenceRequest(sql, requestId), support, request.signal);
      return Response.json({ ok: true });
    }
    return Response.json({ error: "absence" }, { status: 400 });
  } catch (error) {
    return failed(error);
  }
}

import { addEmployeeForm, deleteEmployeeForm, listEmployeeForms, readEmployeeForm } from "../../../db/employee-forms";
import { SaveError } from "../../../db/save";
import { formContentType, formFileName, FORM_BYTE_LIMIT } from "../../../people/forms";
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
  console.error(error instanceof Error ? error.message : "employee form failed");
  return Response.json({ error: "forms" }, { status: 500 });
}

/** The forms kept on one employee. Managers only. */
export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const formId = url.searchParams.get("formId") ?? "";
  const employeeId = url.searchParams.get("employeeId") ?? "";
  if (UUID.test(formId)) {
    try {
      const opened = await withUserDb(userId, (sql) => readEmployeeForm(sql, formId), supportOrgFrom(request), request.signal);
      const ascii = opened.form.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
      return new Response(Buffer.from(opened.body), {
        headers: {
          "content-type": opened.form.type,
          "content-disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(opened.form.name)}`,
          "cache-control": "private, no-store",
        },
      });
    } catch (error) {
      return failed(error);
    }
  }
  if (!UUID.test(employeeId)) return Response.json({ error: "forbidden" }, { status: 400 });
  try {
    const forms = await withUserDb(userId, (sql) => listEmployeeForms(sql, employeeId), supportOrgFrom(request), request.signal);
    return Response.json({ forms });
  } catch (error) {
    return failed(error);
  }
}

/** Store one form on an employee. */
export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const employeeId = typeof form?.get("employeeId") === "string" ? String(form.get("employeeId")) : "";
  const file = form?.get("file");
  if (!UUID.test(employeeId) || !(file instanceof File)) return Response.json({ error: "forms" }, { status: 400 });
  const name = formFileName(file.name);
  const type = formContentType(name, file.type);
  if (!name || !type) return Response.json({ error: "type" }, { status: 400 });
  if (file.size < 1 || file.size > FORM_BYTE_LIMIT) return Response.json({ error: "size" }, { status: 400 });
  const body = new Uint8Array(await file.arrayBuffer());
  try {
    const saved = await withUserDb(
      userId,
      (sql) => addEmployeeForm(sql, { employeeId, name, type, body }),
      supportOrgFrom(request),
      request.signal,
    );
    return Response.json({ form: saved });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const formId = new URL(request.url).searchParams.get("formId") ?? "";
  if (!UUID.test(formId)) return Response.json({ error: "forbidden" }, { status: 400 });
  try {
    await withUserDb(userId, (sql) => deleteEmployeeForm(sql, formId), supportOrgFrom(request), request.signal);
    return Response.json({ ok: true });
  } catch (error) {
    return failed(error);
  }
}

import { FORM_BYTE_LIMIT, FORM_COUNT_LIMIT, formContentType, formFileName, type EmployeeFormRecord } from "../people/forms";
import { SaveError } from "./save";
import type { SqlClient } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FormRow {
  id: string;
  file_name: string;
  content_type: string;
  byte_size: number;
  created_at: unknown;
  body?: unknown;
}

function fail(error: unknown): never {
  if (error instanceof SaveError) throw error;
  const message = error instanceof Error ? error.message : "";
  if (/42501|permission denied|row-level security/i.test(message)) throw new SaveError("forbidden");
  if (/byte_size|octet_length|check constraint/i.test(message)) throw new SaveError("size");
  throw new SaveError("forms");
}

function stamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const time = Date.parse(value);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  throw new SaveError("forms");
}

function record(row: FormRow): EmployeeFormRecord {
  return {
    id: row.id,
    name: row.file_name,
    type: row.content_type,
    bytes: Number(row.byte_size),
    addedAt: stamp(row.created_at),
  };
}

export function formBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string" && value.startsWith("\\x")) {
    const hex = value.slice(2);
    if (hex.length % 2 !== 0) throw new SaveError("forms");
    const out = new Uint8Array(hex.length / 2);
    for (let index = 0; index < out.length; index += 1) out[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    return out;
  }
  throw new SaveError("forms");
}

export async function listEmployeeForms(sql: SqlClient, employeeId: string): Promise<EmployeeFormRecord[]> {
  if (!UUID.test(employeeId)) throw new SaveError("forbidden");
  try {
    const rows = await sql.query<FormRow>(
      `select id, file_name, content_type, byte_size, created_at
       from public.employee_documents
       where employee_id = $1
       order by created_at desc, file_name`,
      [employeeId],
    );
    return rows.map(record);
  } catch (error) {
    fail(error);
  }
}

export async function addEmployeeForm(
  sql: SqlClient,
  input: { employeeId: string; name: string; type: string; body: Uint8Array },
): Promise<EmployeeFormRecord> {
  const name = formFileName(input.name);
  const type = formContentType(name, input.type);
  if (!UUID.test(input.employeeId) || !name || !type) throw new SaveError("type");
  if (input.body.byteLength < 1 || input.body.byteLength > FORM_BYTE_LIMIT) throw new SaveError("size");
  try {
    const count = await sql.query<{ n: number }>(
      `select count(*)::int as n from public.employee_documents where employee_id = $1`,
      [input.employeeId],
    );
    if ((count[0]?.n ?? 0) >= FORM_COUNT_LIMIT) throw new SaveError("full");
    const rows = await sql.query<FormRow>(
      `insert into public.employee_documents (org_id, employee_id, file_name, content_type, byte_size, body)
       select e.org_id, e.id, $2, $3, $4, $5
       from public.employees e
       where e.id = $1
       returning id, file_name, content_type, byte_size, created_at`,
      [input.employeeId, name, type, input.body.byteLength, input.body],
    );
    const saved = rows[0];
    if (!saved) throw new SaveError("forbidden");
    return record(saved);
  } catch (error) {
    fail(error);
  }
}

export async function readEmployeeForm(sql: SqlClient, formId: string): Promise<{ form: EmployeeFormRecord; body: Uint8Array }> {
  if (!UUID.test(formId)) throw new SaveError("forbidden");
  try {
    const rows = await sql.query<FormRow>(
      `select id, file_name, content_type, byte_size, created_at, body
       from public.employee_documents
       where id = $1`,
      [formId],
    );
    const row = rows[0];
    if (!row) throw new SaveError("forbidden");
    return { form: record(row), body: formBytes(row.body) };
  } catch (error) {
    fail(error);
  }
}

export async function deleteEmployeeForm(sql: SqlClient, formId: string): Promise<void> {
  if (!UUID.test(formId)) throw new SaveError("forbidden");
  try {
    const rows = await sql.query<{ id: string }>(`delete from public.employee_documents where id = $1 returning id`, [formId]);
    if (!rows[0]) throw new SaveError("forbidden");
  } catch (error) {
    fail(error);
  }
}

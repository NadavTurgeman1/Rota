import { addEmployeeForm, formBytes } from "./employee-forms";
import { SaveError } from "./save";
import type { SqlClient } from "./types";
import type { AbsenceKind } from "../domain/absence";
import { FORM_BYTE_LIMIT, formContentType, formFileName } from "../people/forms";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FILE_LIMIT = 8;

export type AbsenceStatus = "open" | "approved" | "rejected" | "cancelled";

export interface AbsenceFile {
  id: string;
  name: string;
  type: string;
  bytes: number;
  addedAt: string;
}

export interface AbsenceRequest {
  id: string;
  siteId: string;
  employeeId: string;
  employeeName: string;
  kind: AbsenceKind;
  start: string;
  end: string;
  note: string;
  status: AbsenceStatus;
  createdAt: string;
  decidedAt: string | null;
  files: AbsenceFile[];
}

interface RequestRow {
  id: string;
  site_id: string;
  employee_id: string;
  employee_name: string;
  kind: AbsenceKind;
  start_date: string;
  end_date: string;
  note: string;
  status: AbsenceStatus;
  created_at: unknown;
  decided_at: unknown;
}

interface FileRow {
  id: string;
  request_id: string;
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
  if (message === "overlap" || message === "when" || message === "empty") throw new SaveError(message);
  throw new SaveError("absence");
}

function stamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const time = Date.parse(value);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  throw new SaveError("absence");
}

function stampOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  return stamp(value);
}

function fileRecord(row: FileRow): AbsenceFile {
  return {
    id: row.id,
    name: row.file_name,
    type: row.content_type,
    bytes: Number(row.byte_size),
    addedAt: stamp(row.created_at),
  };
}

function fromRow(row: RequestRow, files: AbsenceFile[]): AbsenceRequest {
  return {
    id: row.id,
    siteId: row.site_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    kind: row.kind,
    start: row.start_date,
    end: row.end_date,
    note: row.note ?? "",
    status: row.status,
    createdAt: stamp(row.created_at),
    decidedAt: stampOrNull(row.decided_at),
    files,
  };
}

const SELECT = `select r.id, r.site_id, r.employee_id, e.name as employee_name, r.kind,
                       to_char(r.start_date, 'YYYY-MM-DD') as start_date,
                       to_char(r.end_date, 'YYYY-MM-DD') as end_date,
                       r.note, r.status,
                       to_json(r.created_at) #>> '{}' as created_at,
                       to_json(r.decided_at) #>> '{}' as decided_at
                from public.absence_requests r
                join public.employees e on e.id = r.employee_id and e.org_id = r.org_id`;

async function attachFiles(sql: SqlClient, rows: RequestRow[]): Promise<AbsenceRequest[]> {
  if (rows.length === 0) return [];
  const files = await sql.query<FileRow>(
    `select id, request_id, file_name, content_type, byte_size, to_json(created_at) #>> '{}' as created_at
     from public.absence_documents
     where request_id = any($1::uuid[])
     order by created_at, file_name`,
    [rows.map((row) => row.id)],
  );
  const grouped = new Map<string, AbsenceFile[]>();
  for (const file of files) {
    const list = grouped.get(file.request_id) ?? [];
    list.push(fileRecord(file));
    grouped.set(file.request_id, list);
  }
  return rows.map((row) => fromRow(row, grouped.get(row.id) ?? []));
}

export async function listAbsenceRequests(sql: SqlClient, siteId?: string): Promise<AbsenceRequest[]> {
  if (siteId && !UUID.test(siteId)) throw new SaveError("forbidden");
  try {
    const rows = siteId
      ? await sql.query<RequestRow>(`${SELECT} where r.site_id = $1 order by r.created_at desc, r.id desc`, [siteId])
      : await sql.query<RequestRow>(
          `${SELECT}
           where (select private.owns_employee(r.employee_id, r.org_id))
           order by r.created_at desc, r.id desc`,
        );
    return attachFiles(sql, rows);
  } catch (error) {
    fail(error);
  }
}

export async function createAbsenceRequest(
  sql: SqlClient,
  input: {
    siteId: string;
    employeeId?: string;
    kind: AbsenceKind;
    start: string;
    end: string;
    note: string;
    files: { name: string; type: string; body: Uint8Array }[];
  },
): Promise<AbsenceRequest> {
  if (!UUID.test(input.siteId)) throw new SaveError("forbidden");
  if (input.kind !== "sick" && input.kind !== "vacation") throw new SaveError("absence");
  if (!DAY.test(input.start) || !DAY.test(input.end) || input.end < input.start) throw new SaveError("when");
  const span = (Date.parse(`${input.end}T00:00:00Z`) - Date.parse(`${input.start}T00:00:00Z`)) / 86_400_000;
  if (!Number.isFinite(span) || span > 120) throw new SaveError("when");
  const note = input.note.trim().slice(0, 2000);
  const incoming = input.kind === "sick" ? input.files : [];
  if (incoming.length > FILE_LIMIT) throw new SaveError("full");
  const savedFiles: { name: string; type: string; body: Uint8Array }[] = [];
  for (const file of incoming) {
    const name = formFileName(file.name);
    const type = formContentType(name, file.type);
    if (!name || !type) throw new SaveError("type");
    if (file.body.byteLength < 1 || file.body.byteLength > FORM_BYTE_LIMIT) throw new SaveError("size");
    savedFiles.push({ name, type, body: file.body });
  }
  try {
    const person = input.employeeId
      ? await sql.query<{ id: string }>(
          `select e.id
           from public.employees e
           join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
           where es.site_id = $1 and e.id = $2`,
          [input.siteId, input.employeeId],
        )
      : await sql.query<{ id: string }>(
          `select e.id
           from public.employees e
           join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
           where es.site_id = $1 and e.user_id = (select auth.uid())`,
          [input.siteId],
        );
    const employeeId = person[0]?.id;
    if (!employeeId) throw new SaveError("forbidden");
    const clash = await sql.query<{ id: string }>(
      `select id
       from public.absence_requests
       where employee_id = $1
         and status in ('open', 'approved')
         and start_date <= $3::date
         and end_date >= $2::date
       limit 1`,
      [employeeId, input.start, input.end],
    );
    if (clash[0]) throw new SaveError("overlap");
    const manager = input.employeeId
      ? await sql.query<{ ok: boolean }>(`select private.manages_site($1) as ok`, [input.siteId])
      : [{ ok: false }];
    const status = manager[0]?.ok && input.employeeId ? "approved" : "open";
    const inserted = await sql.query<RequestRow>(
      `insert into public.absence_requests (
         org_id, site_id, employee_id, kind, start_date, end_date, note, status, decided_at, decided_by
       )
       select s.org_id, s.id, $2, $3, $4::date, $5::date, $6, $7,
              case when $7 = 'approved' then now() else null end,
              case when $7 = 'approved' then (select auth.uid()) else null end
       from public.sites s
       where s.id = $1
       returning id, site_id, employee_id, $8::text as employee_name, kind,
                 to_char(start_date, 'YYYY-MM-DD') as start_date,
                 to_char(end_date, 'YYYY-MM-DD') as end_date,
                 note, status,
                 to_json(created_at) #>> '{}' as created_at,
                 to_json(decided_at) #>> '{}' as decided_at`,
      [input.siteId, employeeId, input.kind, input.start, input.end, note, status, ""],
    );
    const row = inserted[0];
    if (!row) throw new SaveError("forbidden");
    for (const file of savedFiles) {
      await sql.query(
        `insert into public.absence_documents (
           org_id, site_id, request_id, employee_id, file_name, content_type, byte_size, body
         )
         select r.org_id, r.site_id, r.id, r.employee_id, $2, $3, $4, $5
         from public.absence_requests r
         where r.id = $1`,
        [row.id, file.name, file.type, file.body.byteLength, file.body],
      );
    }
    const listed = await sql.query<RequestRow>(`${SELECT} where r.id = $1`, [row.id]);
    const [saved] = await attachFiles(sql, listed);
    if (!saved) throw new SaveError("forbidden");
    if (saved.status === "approved") {
      await applyApprovedAbsence(sql, employeeId, saved.siteId, saved.start, saved.end);
      if (saved.kind === "sick") await copySickFilesToEmployee(sql, saved.id, employeeId);
    }
    return saved;
  } catch (error) {
    fail(error);
  }
}

async function copySickFilesToEmployee(sql: SqlClient, requestId: string, employeeId: string): Promise<void> {
  const files = await sql.query<FileRow>(
    `select d.id, d.request_id, d.file_name, d.content_type, d.byte_size, to_json(d.created_at) #>> '{}' as created_at, d.body
     from public.absence_documents d
     join public.absence_requests r on r.id = d.request_id
     where d.request_id = $1 and r.kind = 'sick'
     order by d.created_at, d.file_name`,
    [requestId],
  );
  for (const file of files) {
    try {
      await addEmployeeForm(sql, {
        employeeId,
        name: file.file_name,
        type: file.content_type,
        body: formBytes(file.body),
      });
    } catch (error) {
      if (error instanceof SaveError && error.message === "full") return;
      throw error;
    }
  }
}

async function applyApprovedAbsence(sql: SqlClient, employeeId: string, siteId: string, start: string, end: string): Promise<void> {
  await sql.query(
    `delete from public.availability_entries e
     using public.availability_weeks w
     where e.availability_week_id = w.id
       and w.employee_id = $1
       and w.site_id = $2
       and (w.week_start + e.weekday) between $3::date and $4::date`,
    [employeeId, siteId, start, end],
  );
  await sql.query(
    `insert into public.schedule_calloffs (
       org_id, schedule_id, shift_id, weekday, employee_id, reported_at, reported_by_name
     )
     select a.org_id, a.schedule_id, a.shift_id, a.weekday, a.employee_id, now(), 'manager'
     from public.assignments a
     join public.schedules s on s.id = a.schedule_id and s.org_id = a.org_id
     where a.employee_id = $1
       and s.site_id = $2
       and s.status = 'published'
       and (s.week_start + a.weekday) between $3::date and $4::date`,
    [employeeId, siteId, start, end],
  );
  await sql.query(
    `delete from public.assignments a
     using public.schedules s
     where a.schedule_id = s.id
       and a.org_id = s.org_id
       and a.employee_id = $1
       and s.site_id = $2
       and (s.week_start + a.weekday) between $3::date and $4::date`,
    [employeeId, siteId, start, end],
  );
}

export async function decideAbsenceRequest(sql: SqlClient, requestId: string, approve: boolean): Promise<void> {
  if (!UUID.test(requestId)) throw new SaveError("forbidden");
  try {
    const row = await sql.query<{ employee_id: string; kind: AbsenceKind; site_id: string; start_date: string; end_date: string }>(
      `select employee_id, kind, site_id,
              to_char(start_date, 'YYYY-MM-DD') as start_date,
              to_char(end_date, 'YYYY-MM-DD') as end_date
       from public.absence_requests where id = $1`,
      [requestId],
    );
    await sql.query(`select public.decide_absence_request($1, $2)`, [requestId, approve]);
    const request = row[0];
    if (approve && request) {
      await applyApprovedAbsence(sql, request.employee_id, request.site_id, request.start_date, request.end_date);
      if (request.kind === "sick") await copySickFilesToEmployee(sql, requestId, request.employee_id);
    }
  } catch (error) {
    fail(error);
  }
}

export async function deleteAbsenceRequest(sql: SqlClient, requestId: string): Promise<void> {
  if (!UUID.test(requestId)) throw new SaveError("forbidden");
  try {
    const rows = await sql.query<{ id: string }>(
      `delete from public.absence_requests where id = $1 returning id`,
      [requestId],
    );
    if (!rows[0]) throw new SaveError("forbidden");
  } catch (error) {
    fail(error);
  }
}

export async function readAbsenceFile(sql: SqlClient, fileId: string): Promise<{ file: AbsenceFile; body: Uint8Array }> {
  if (!UUID.test(fileId)) throw new SaveError("forbidden");
  try {
    const rows = await sql.query<FileRow>(
      `select id, request_id, file_name, content_type, byte_size, to_json(created_at) #>> '{}' as created_at, body
       from public.absence_documents
       where id = $1`,
      [fileId],
    );
    const row = rows[0];
    if (!row) throw new SaveError("forbidden");
    return { file: fileRecord(row), body: formBytes(row.body) };
  } catch (error) {
    fail(error);
  }
}

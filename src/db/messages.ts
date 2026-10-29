import { shiftDueAt, wallInstant } from "../domain/messages";
import { SaveError } from "./save";
import type { SqlClient } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCAL = /^(\d{4}-\d{2}-\d{2})T(([01]\d|2[0-3]):[0-5]\d)$/;

export type MessageAudience = "all" | "people" | "shift";
export type MessageDeliver = "now" | "at" | "shift_start";

export interface MessageRecipient {
  id: string;
  name: string;
  readAt: string | null;
}

export interface ManagerMessage {
  id: string;
  siteId: string;
  body: string;
  audience: MessageAudience;
  deliver: MessageDeliver;
  dueAt: string;
  createdAt: string;
  authorName: string;
  week: string | null;
  shiftId: string | null;
  weekday: number | null;
  readAt: string | null;
  seenPopupAt: string | null;
  recipientCount: number;
  readCount: number;
  recipients: MessageRecipient[];
}

export interface MessageDraft {
  siteId: string;
  body: string;
  audience: MessageAudience;
  deliver: MessageDeliver;
  employeeIds?: string[];
  at?: string;
  week?: string;
  shiftId?: string;
  weekday?: number;
}

interface MessageRow {
  id: string;
  site_id: string;
  body: string;
  audience: MessageAudience;
  deliver: MessageDeliver;
  due_at: unknown;
  created_at: unknown;
  author_name: string;
  week_start: string | null;
  shift_id: string | null;
  weekday: number | null;
  read_at?: unknown;
  seen_popup_at?: unknown;
}

function fail(error: unknown): never {
  if (error instanceof SaveError) throw error;
  const message = error instanceof Error ? error.message : "";
  if (/42501|permission denied|row-level security/i.test(message)) throw new SaveError("forbidden");
  if (message === "when") throw new SaveError("when");
  throw new SaveError("messages");
}

function stamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const time = Date.parse(value);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  throw new SaveError("messages");
}

function stampOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  return stamp(value);
}

function clockFrom(value: string): string {
  const time = value.slice(0, 5);
  if (!CLOCK.test(time)) throw new SaveError("when");
  return time;
}

function dueFromDraft(
  draft: MessageDraft,
  site: { timezone: string; start: string | null },
): { dueAt: string; week: string | null; shiftId: string | null; weekday: number | null } {
  const needSlot = draft.audience === "shift" || draft.deliver === "shift_start";
  const week = WEEK.test(draft.week ?? "") ? draft.week! : null;
  const shiftId = UUID.test(draft.shiftId ?? "") ? draft.shiftId! : null;
  const weekday = Number.isInteger(draft.weekday) && draft.weekday! >= 0 && draft.weekday! <= 6 ? draft.weekday! : null;
  if (needSlot && (!week || !shiftId || weekday == null)) throw new SaveError("when");
  if (!needSlot && (week || shiftId || weekday != null)) throw new SaveError("when");
  if (draft.deliver === "now") {
    return { dueAt: new Date().toISOString(), week, shiftId, weekday };
  }
  if (draft.deliver === "at") {
    const raw = draft.at?.trim() ?? "";
    const local = LOCAL.exec(raw);
    const dueAt = local ? wallInstant(local[1], local[2], site.timezone) : Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : "";
    if (!dueAt) throw new SaveError("when");
    return { dueAt, week, shiftId, weekday };
  }
  if (!site.start) throw new SaveError("when");
  return { dueAt: shiftDueAt(week!, weekday!, clockFrom(site.start), site.timezone), week, shiftId, weekday };
}

function fromRow(
  row: MessageRow,
  extras?: { readAt?: string | null; seenPopupAt?: string | null; recipients?: MessageRecipient[] },
): ManagerMessage {
  const recipients = extras?.recipients ?? [];
  return {
    id: row.id,
    siteId: row.site_id,
    body: row.body,
    audience: row.audience,
    deliver: row.deliver,
    dueAt: stamp(row.due_at),
    createdAt: stamp(row.created_at),
    authorName: row.author_name ?? "",
    week: row.week_start,
    shiftId: row.shift_id,
    weekday: row.weekday,
    readAt: extras?.readAt ?? stampOrNull(row.read_at) ?? null,
    seenPopupAt: extras?.seenPopupAt ?? stampOrNull(row.seen_popup_at) ?? null,
    recipientCount: recipients.length,
    readCount: recipients.filter((item) => item.readAt).length,
    recipients,
  };
}

const SELECT = `select id, site_id, body, audience, deliver,
                       to_json(due_at) #>> '{}' as due_at,
                       to_json(created_at) #>> '{}' as created_at,
                       author_name,
                       to_char(week_start, 'YYYY-MM-DD') as week_start,
                       shift_id, weekday::int as weekday
                from public.manager_messages`;

async function attachRecipients(sql: SqlClient, rows: MessageRow[]): Promise<ManagerMessage[]> {
  if (rows.length === 0) return [];
  const people = await sql.query<{ message_id: string; id: string; name: string; read_at: unknown }>(
    `select r.message_id, e.id, e.name, to_json(r.read_at) #>> '{}' as read_at
     from public.manager_message_recipients r
     join public.employees e on e.id = r.employee_id and e.org_id = r.org_id
     where r.message_id = any($1::uuid[])
     order by e.name`,
    [rows.map((row) => row.id)],
  );
  const grouped = new Map<string, MessageRecipient[]>();
  for (const person of people) {
    const list = grouped.get(person.message_id) ?? [];
    list.push({ id: person.id, name: person.name, readAt: stampOrNull(person.read_at) });
    grouped.set(person.message_id, list);
  }
  return rows.map((row) => fromRow(row, { recipients: grouped.get(row.id) ?? [] }));
}

async function recipientIds(sql: SqlClient, draft: MessageDraft): Promise<string[]> {
  if (draft.audience === "people") {
    const wanted = [...new Set((draft.employeeIds ?? []).filter((id) => UUID.test(id)))];
    if (wanted.length === 0) throw new SaveError("empty");
    const rows = await sql.query<{ id: string }>(
      `select e.id
       from public.employees e
       join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
       where es.site_id = $1 and e.active and e.id = any($2::uuid[])`,
      [draft.siteId, wanted],
    );
    if (rows.length !== wanted.length) throw new SaveError("empty");
    return wanted;
  }
  if (draft.audience === "shift") {
    if (!WEEK.test(draft.week ?? "") || !UUID.test(draft.shiftId ?? "") || !Number.isInteger(draft.weekday)) {
      throw new SaveError("when");
    }
    const rows = await sql.query<{ id: string }>(
      `select distinct a.employee_id as id
       from public.schedules s
       join public.assignments a on a.schedule_id = s.id and a.org_id = s.org_id
       where s.site_id = $1
         and s.week_start = $2::date
         and a.shift_id = $3
         and a.weekday = $4`,
      [draft.siteId, draft.week, draft.shiftId, draft.weekday],
    );
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) throw new SaveError("empty");
    return ids;
  }
  const rows = await sql.query<{ id: string }>(
    `select e.id
     from public.employees e
     join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
     where es.site_id = $1 and e.active`,
    [draft.siteId],
  );
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) throw new SaveError("empty");
  return ids;
}

/** Notes a manager may see for one site, newest first. */
export async function listManagerMessages(sql: SqlClient, siteId: string): Promise<ManagerMessage[]> {
  if (!UUID.test(siteId)) throw new SaveError("forbidden");
  try {
    const rows = await sql.query<MessageRow>(
      `${SELECT}
       where site_id = $1
       order by created_at desc, id desc`,
      [siteId],
    );
    return attachRecipients(sql, rows);
  } catch (error) {
    fail(error);
  }
}

/** Due notes for the signed-in employee, newest due first. */
export async function listStaffMessages(sql: SqlClient): Promise<ManagerMessage[]> {
  try {
    const rows = await sql.query<MessageRow>(
      `select m.id, m.site_id, m.body, m.audience, m.deliver,
              to_json(m.due_at) #>> '{}' as due_at,
              to_json(m.created_at) #>> '{}' as created_at,
              m.author_name,
              to_char(m.week_start, 'YYYY-MM-DD') as week_start,
              m.shift_id, m.weekday::int as weekday,
              to_json(r.read_at) #>> '{}' as read_at,
              to_json(r.seen_popup_at) #>> '{}' as seen_popup_at
       from public.manager_messages m
       join public.manager_message_recipients r on r.message_id = m.id and r.org_id = m.org_id
       where (select private.owns_employee(r.employee_id, r.org_id))
         and m.due_at <= now()
       order by m.due_at desc, m.created_at desc, m.id desc`,
    );
    return rows.map((row) =>
      fromRow(row, {
        readAt: stampOrNull(row.read_at),
        seenPopupAt: stampOrNull(row.seen_popup_at),
        recipients: [],
      }),
    );
  } catch (error) {
    fail(error);
  }
}

export async function createManagerMessage(sql: SqlClient, draft: MessageDraft): Promise<ManagerMessage> {
  if (!UUID.test(draft.siteId)) throw new SaveError("forbidden");
  const body = draft.body.trim();
  if (body.length < 1 || body.length > 4000) throw new SaveError("body");
  if (draft.audience !== "all" && draft.audience !== "people" && draft.audience !== "shift") throw new SaveError("messages");
  if (draft.deliver !== "now" && draft.deliver !== "at" && draft.deliver !== "shift_start") throw new SaveError("messages");
  try {
    const site = await sql.query<{ timezone: string; start: string | null }>(
      `select s.timezone, sh.starts_at::text as start
       from public.sites s
       left join public.shifts sh on sh.id = $2 and sh.site_id = s.id
       where s.id = $1`,
      [draft.siteId, UUID.test(draft.shiftId ?? "") ? draft.shiftId : "00000000-0000-4000-8000-000000000000"],
    );
    const found = site[0];
    if (!found) throw new SaveError("forbidden");
    const when = dueFromDraft(draft, found);
    const people = await recipientIds(sql, draft);
    const inserted = await sql.query<MessageRow>(
      `insert into public.manager_messages (
         org_id, site_id, author_id, author_name, body, audience, deliver, due_at, week_start, shift_id, weekday
       )
       select s.org_id, s.id, (select auth.uid()),
              coalesce((select nullif(btrim(p.name), '') from public.profiles p where p.user_id = (select auth.uid())), ''),
              $2, $3, $4, $5::timestamptz, $6::date, $7::uuid, $8::smallint
       from public.sites s
       where s.id = $1
       returning id, site_id, body, audience, deliver,
                 to_json(due_at) #>> '{}' as due_at,
                 to_json(created_at) #>> '{}' as created_at,
                 author_name,
                 to_char(week_start, 'YYYY-MM-DD') as week_start,
                 shift_id, weekday::int as weekday`,
      [draft.siteId, body, draft.audience, draft.deliver, when.dueAt, when.week, when.shiftId, when.weekday],
    );
    const row = inserted[0];
    if (!row) throw new SaveError("forbidden");
    await sql.query(
      `insert into public.manager_message_recipients (org_id, site_id, message_id, employee_id)
       select m.org_id, m.site_id, m.id, e.id
       from public.manager_messages m
       join public.employees e on e.org_id = m.org_id and e.id = any($2::uuid[])
       where m.id = $1`,
      [row.id, people],
    );
    const [saved] = await attachRecipients(sql, [row]);
    if (!saved) throw new SaveError("forbidden");
    return saved;
  } catch (error) {
    fail(error);
  }
}

export async function deleteManagerMessage(sql: SqlClient, messageId: string): Promise<void> {
  if (!UUID.test(messageId)) throw new SaveError("forbidden");
  try {
    const rows = await sql.query<{ id: string }>(`delete from public.manager_messages where id = $1 returning id`, [messageId]);
    if (!rows[0]) throw new SaveError("forbidden");
  } catch (error) {
    fail(error);
  }
}

export async function acknowledgeManagerMessage(sql: SqlClient, messageId: string, kind: "popup" | "read"): Promise<void> {
  if (!UUID.test(messageId) || (kind !== "popup" && kind !== "read")) throw new SaveError("forbidden");
  try {
    await sql.query(`select public.acknowledge_manager_message($1, $2)`, [messageId, kind]);
  } catch (error) {
    fail(error);
  }
}

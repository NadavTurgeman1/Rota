import { describe, expect, it } from "vitest";
import { slots, staticReason } from "../domain/rules";
import { createAbsenceRequest, decideAbsenceRequest, deleteAbsenceRequest, listAbsenceRequests } from "./absences";
import { listEmployeeForms } from "./employee-forms";
import { loadSiteWeek } from "./load";
import { SaveError } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";
import { inviteStaffLogin } from "./workspace-store";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const dana = "44444444-4444-4444-8444-444444444401";
const owner = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const manager = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const worker = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

async function openSite() {
  const db = await openTestDatabase();
  const sql = client(db);
  await db.exec(
    `insert into auth.users (id, email) values
       ('${owner}', 'owner.absences@example.com'),
       ('${manager}', 'manager.absences@example.com');
     insert into public.memberships (org_id, user_id, role) values
       ('${sentinel}', '${owner}', 'owner'),
       ('${sentinel}', '${manager}', 'manager');
     insert into public.site_memberships (org_id, site_id, user_id, role)
     values ('${sentinel}', '${headquarters}', '${manager}', 'manager');`,
  );
  await asRole(db, "authenticated", owner);
  expect(await inviteStaffLogin(sql, { orgId: sentinel, employeeId: dana, email: "dana.absences@example.com" })).toBe("invited");
  await db.exec("reset role");
  await db.exec(`insert into auth.users (id, email) values ('${worker}', 'dana.absences@example.com');`);
  return { db, sql };
}

describe("absence requests", () => {
  it("lets an employee file sick days, and a manager approve them so the engine blocks the day", async () => {
    const { db, sql } = await openSite();
    await asRole(db, "authenticated", worker);
    const filed = await createAbsenceRequest(sql, {
      siteId: headquarters,
      kind: "sick",
      start: "2026-10-11",
      end: "2026-10-12",
      note: "חום",
      files: [],
    });
    expect(filed.status).toBe("open");
    expect(filed.kind).toBe("sick");

    await asRole(db, "authenticated", manager);
    const pending = await listAbsenceRequests(sql, headquarters);
    expect(pending.map((row) => row.id)).toContain(filed.id);
    await decideAbsenceRequest(sql, filed.id, true);

    await db.exec("reset role");
    const state = await loadSiteWeek(sql, headquarters, "2026-10-11");
    const person = state.emps.find((item) => item.id === dana)!;
    const sunday = slots(state, state.week).find((slot) => slot.day === 0)!;
    expect(staticReason(state, person, sunday, state.week)).toMatchObject({ code: "absent", kind: "sick" });
    const tuesday = slots(state, state.week).find((slot) => slot.day === 2);
    if (tuesday) expect(staticReason(state, person, tuesday, state.week)?.code).not.toBe("absent");
  });

  it("rejects a range that overlaps an open report", async () => {
    const { db, sql } = await openSite();
    await asRole(db, "authenticated", worker);
    await createAbsenceRequest(sql, {
      siteId: headquarters,
      kind: "vacation",
      start: "2026-10-11",
      end: "2026-10-13",
      note: "",
      files: [],
    });
    await expect(
      createAbsenceRequest(sql, {
        siteId: headquarters,
        kind: "sick",
        start: "2026-10-13",
        end: "2026-10-14",
        note: "",
        files: [],
      }),
    ).rejects.toBeInstanceOf(SaveError);
  });

  it("keeps a sick note on the employee forms after approval, and ignores files on vacation", async () => {
    const { db, sql } = await openSite();
    const body = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    await asRole(db, "authenticated", worker);
    const sick = await createAbsenceRequest(sql, {
      siteId: headquarters,
      kind: "sick",
      start: "2026-11-01",
      end: "2026-11-01",
      note: "",
      files: [{ name: "note.pdf", type: "application/pdf", body }],
    });
    expect(sick.files.map((file) => file.name)).toEqual(["note.pdf"]);
    const vacation = await createAbsenceRequest(sql, {
      siteId: headquarters,
      kind: "vacation",
      start: "2026-11-08",
      end: "2026-11-09",
      note: "",
      files: [{ name: "ignored.pdf", type: "application/pdf", body }],
    });
    expect(vacation.files).toEqual([]);

    await asRole(db, "authenticated", manager);
    await decideAbsenceRequest(sql, sick.id, true);
    const forms = await listEmployeeForms(sql, dana);
    expect(forms.map((form) => form.name)).toEqual(["note.pdf"]);
  });

  it("clears those days from weekly constraints and seats after approval", async () => {
    const { db, sql } = await openSite();
    const morning = "33333333-3333-4333-8333-333333333301";
    await db.exec("reset role");
    await db.exec(
      `insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
       values ('${sentinel}', '${headquarters}', '${dana}', '2026-10-11');
       insert into public.availability_entries (org_id, availability_week_id, shift_id, weekday)
       select '${sentinel}', w.id, '${morning}', day.weekday
       from public.availability_weeks w
       cross join generate_series(0, 6) as day(weekday)
       where w.employee_id = '${dana}' and w.week_start = '2026-10-11';
       insert into public.schedules (id, org_id, site_id, week_start, status) values
         ('66666666-6666-4666-8666-6666666666a1', '${sentinel}', '${headquarters}', '2026-10-11', 'published'),
         ('66666666-6666-4666-8666-6666666666a2', '${sentinel}', '${headquarters}', '2026-10-18', 'draft');
       insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id) values
         ('${sentinel}', '66666666-6666-4666-8666-6666666666a1', '${morning}', 0, '${dana}'),
         ('${sentinel}', '66666666-6666-4666-8666-6666666666a1', '${morning}', 2, '${dana}'),
         ('${sentinel}', '66666666-6666-4666-8666-6666666666a2', '${morning}', 0, '${dana}');`,
    );

    await asRole(db, "authenticated", worker);
    const filed = await createAbsenceRequest(sql, {
      siteId: headquarters,
      kind: "vacation",
      start: "2026-10-11",
      end: "2026-10-12",
      note: "",
      files: [],
    });
    await asRole(db, "authenticated", manager);
    await decideAbsenceRequest(sql, filed.id, true);

    await db.exec("reset role");
    const leftover = await sql.query<{ weekday: number }>(
      `select e.weekday
       from public.availability_entries e
       join public.availability_weeks w on w.id = e.availability_week_id
       where w.employee_id = $1 and w.week_start = '2026-10-11'
       order by e.weekday`,
      [dana],
    );
    expect(leftover.map((row) => Number(row.weekday))).toEqual([2, 3, 4, 5, 6]);
    const seats = await sql.query<{ week: string; weekday: number }>(
      `select to_char(s.week_start, 'YYYY-MM-DD') as week, a.weekday
       from public.assignments a
       join public.schedules s on s.id = a.schedule_id
       where a.employee_id = $1
       order by s.week_start, a.weekday`,
      [dana],
    );
    expect(seats.map((row) => ({ week: row.week, weekday: Number(row.weekday) }))).toEqual([
      { week: "2026-10-11", weekday: 2 },
      { week: "2026-10-18", weekday: 0 },
    ]);
    const calloffs = await sql.query<{ weekday: number }>(
      `select weekday from public.schedule_calloffs where employee_id = $1 order by weekday`,
      [dana],
    );
    expect(calloffs.map((row) => Number(row.weekday))).toEqual([0]);
  });

  it("lets a manager delete an approved absence from the list", async () => {
    const { db, sql } = await openSite();
    await asRole(db, "authenticated", worker);
    const filed = await createAbsenceRequest(sql, {
      siteId: headquarters,
      kind: "vacation",
      start: "2026-12-01",
      end: "2026-12-01",
      note: "",
      files: [],
    });
    await asRole(db, "authenticated", manager);
    await decideAbsenceRequest(sql, filed.id, true);
    await deleteAbsenceRequest(sql, filed.id);
    const left = await listAbsenceRequests(sql, headquarters);
    expect(left.map((row) => row.id)).not.toContain(filed.id);
  });
});

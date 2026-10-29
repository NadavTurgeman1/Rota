import { describe, expect, it } from "vitest";
import { acknowledgeManagerMessage, createManagerMessage, listManagerMessages, listStaffMessages } from "./messages";
import { SaveError } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";
import { inviteStaffLogin } from "./workspace-store";

const sentinel = "11111111-1111-4111-8111-111111111111";
const headquarters = "22222222-2222-4222-8222-222222222222";
const morning = "33333333-3333-4333-8333-333333333301";
const dana = "44444444-4444-4444-8444-444444444401";
const yossi = "44444444-4444-4444-8444-444444444402";
const owner = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const manager = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const worker = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function openSite() {
  const db = await openTestDatabase();
  const sql = client(db);
  await db.exec(
    `insert into auth.users (id, email) values
       ('${owner}', 'owner.messages@example.com'),
       ('${manager}', 'manager.messages@example.com');
     insert into public.memberships (org_id, user_id, role) values
       ('${sentinel}', '${owner}', 'owner'),
       ('${sentinel}', '${manager}', 'manager');
     insert into public.site_memberships (org_id, site_id, user_id, role)
     values ('${sentinel}', '${headquarters}', '${manager}', 'manager');`,
  );
  await asRole(db, "authenticated", owner);
  expect(await inviteStaffLogin(sql, { orgId: sentinel, employeeId: dana, email: "dana.messages@example.com" })).toBe("invited");
  expect(await inviteStaffLogin(sql, { orgId: sentinel, employeeId: yossi, email: "yossi.messages@example.com" })).toBe("invited");
  await db.exec("reset role");
  await db.exec(
    `insert into auth.users (id, email) values
       ('${worker}', 'dana.messages@example.com'),
       ('${other}', 'yossi.messages@example.com');`,
  );
  return { db, sql };
}

describe("manager messages", () => {
  it("lets a manager send now, hides a scheduled note until it is due, and pops it for the right person", async () => {
    const { db, sql } = await openSite();

    await asRole(db, "authenticated", manager);
    const sent = await createManagerMessage(sql, {
      siteId: headquarters,
      body: "  ברוכים הבאים לבוקר  ",
      audience: "people",
      deliver: "now",
      employeeIds: [dana],
    });
    expect(sent.body).toBe("ברוכים הבאים לבוקר");
    expect(sent.recipients.map((row) => row.id)).toEqual([dana]);

    const later = await createManagerMessage(sql, {
      siteId: headquarters,
      body: "רק אחר כך",
      audience: "all",
      deliver: "at",
      at: "2028-06-01T10:00",
    });
    expect(later.dueAt.startsWith("2028-06-01")).toBe(true);

    const listed = await listManagerMessages(sql, headquarters);
    expect(listed.map((row) => row.body)).toEqual(["רק אחר כך", "ברוכים הבאים לבוקר"]);

    await asRole(db, "authenticated", worker);
    const mine = await listStaffMessages(sql);
    expect(mine.map((row) => row.body)).toEqual(["ברוכים הבאים לבוקר"]);
    expect(mine[0]?.seenPopupAt).toBeNull();
    await acknowledgeManagerMessage(sql, mine[0]!.id, "popup");
    const afterPopup = await listStaffMessages(sql);
    expect(afterPopup[0]?.seenPopupAt).toBeTruthy();
    expect(afterPopup[0]?.readAt).toBeNull();
    await acknowledgeManagerMessage(sql, mine[0]!.id, "read");
    expect((await listStaffMessages(sql))[0]?.readAt).toBeTruthy();

    await asRole(db, "authenticated", other);
    expect(await listStaffMessages(sql)).toEqual([]);

    await asRole(db, "authenticated", worker);
    await expect(createManagerMessage(sql, { siteId: headquarters, body: "לא", audience: "all", deliver: "now" })).rejects.toBeInstanceOf(
      SaveError,
    );
  });

  it("sends to the people on a shift, and waits for that shift to start", async () => {
    const { db, sql } = await openSite();
    await db.exec("reset role");
    await db.exec(
      `insert into public.schedules (id, org_id, site_id, week_start, status)
       values ('66666666-6666-4666-8666-666666666699', '${sentinel}', '${headquarters}', '2028-01-02', 'published');
       insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id)
       values ('${sentinel}', '66666666-6666-4666-8666-666666666699', '${morning}', 0, '${dana}');`,
    );

    await asRole(db, "authenticated", manager);
    await expect(
      createManagerMessage(sql, {
        siteId: headquarters,
        body: "אין אף אחד",
        audience: "shift",
        deliver: "now",
        week: "2028-01-02",
        shiftId: morning,
        weekday: 1,
      }),
    ).rejects.toMatchObject({ message: "empty" });

    const note = await createManagerMessage(sql, {
      siteId: headquarters,
      body: "בוקר טוב למשמרת",
      audience: "shift",
      deliver: "shift_start",
      week: "2028-01-02",
      shiftId: morning,
      weekday: 0,
    });
    expect(note.recipients.map((row) => row.id)).toEqual([dana]);
    expect(note.dueAt).toBe("2028-01-02T04:00:00.000Z");

    await asRole(db, "authenticated", worker);
    expect(await listStaffMessages(sql)).toEqual([]);
  });
});

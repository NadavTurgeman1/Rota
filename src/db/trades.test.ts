import { describe, expect, it } from "vitest";
import { SaveError } from "./save";
import { asRole, client, openTestDatabase } from "./test-db";
import { answerTrade, cancelTrade, createTrade, decideTrade, listTrades, readSiteContext, swapOptions, takeableTrades } from "./trades";

const org = "11111111-1111-4111-8111-111111111111";
const site = "44444444-4444-4444-8444-444444444444";
const morning = "55555555-5555-4555-8555-555555555551";
const night = "55555555-5555-4555-8555-555555555552";
const schedule = "66666666-6666-4666-8666-666666666666";
const week = "2026-10-25";
const people = {
  dana: { employee: "77777777-7777-4777-8777-777777777771", user: "88888888-8888-4888-8888-888888888881" },
  noa: { employee: "77777777-7777-4777-8777-777777777772", user: "88888888-8888-4888-8888-888888888882" },
  avi: { employee: "77777777-7777-4777-8777-777777777773", user: "88888888-8888-4888-8888-888888888883" },
};
const manager = "99999999-9999-4999-8999-999999999999";
const never = () => null;

async function setup() {
  const db = await openTestDatabase();
  const sql = client(db);
  const roster = Object.entries(people);
  await db.exec(`
    insert into public.sites (id, org_id, name, min_rest_hours) values ('${site}', '${org}', 'Trades', 8);
    insert into public.shifts (id, org_id, site_id, name, starts_at, ends_at, position) values
      ('${morning}', '${org}', '${site}', 'Morning', '06:00', '14:00', 0),
      ('${night}', '${org}', '${site}', 'Night', '22:00', '06:00', 1);
    insert into public.shift_requirements (org_id, shift_id, weekday, required_count)
      select '${org}', shift_id, weekday, 1
      from unnest(array['${morning}', '${night}']::uuid[]) as shift_id, generate_series(0, 6) as weekday;
    insert into auth.users (id, email) values
      ${roster.map(([name, ids]) => `('${ids.user}', '${name}@example.com')`).join(", ")},
      ('${manager}', 'manager@example.com');
    insert into public.memberships (org_id, user_id, role) values
      ${roster.map(([, ids]) => `('${org}', '${ids.user}', 'employee')`).join(", ")},
      ('${org}', '${manager}', 'manager');
    insert into public.site_memberships (org_id, site_id, user_id, role) values
      ${roster.map(([, ids]) => `('${org}', '${site}', '${ids.user}', 'employee')`).join(", ")},
      ('${org}', '${site}', '${manager}', 'manager');
    insert into public.employees (id, org_id, name, weekly_shift_quota, user_id) values
      ${roster.map(([name, ids]) => `('${ids.employee}', '${org}', '${name}', 3, '${ids.user}')`).join(", ")};
    insert into public.employee_sites (org_id, employee_id, site_id)
      select '${org}', id, '${site}' from public.employees where id in (${roster.map(([, ids]) => `'${ids.employee}'`).join(", ")});
    insert into public.employee_agreements (org_id, employee_id, shift_id, weekday)
      select '${org}', e.id, s.id, d from public.employees e, public.shifts s, generate_series(0, 6) d
      where s.site_id = '${site}' and e.id in (${roster.map(([, ids]) => `'${ids.employee}'`).join(", ")});
    insert into public.schedules (id, org_id, site_id, week_start, status) values ('${schedule}', '${org}', '${site}', '${week}', 'published');
    insert into public.assignments (org_id, schedule_id, shift_id, weekday, employee_id) values
      ('${org}', '${schedule}', '${morning}', 0, '${people.dana.employee}'),
      ('${org}', '${schedule}', '${morning}', 1, '${people.noa.employee}'),
      ('${org}', '${schedule}', '${night}', 1, '${people.noa.employee}'),
      ('${org}', '${schedule}', '${morning}', 2, '${people.avi.employee}'),
      ('${org}', '${schedule}', '${night}', 0, '${people.avi.employee}');
  `);
  let current = "";
  const as = async (userId: string) => {
    current = userId;
    await asRole(db, "authenticated", userId);
  };
  const read = async (siteId: string, at: string) => {
    await db.exec("reset role");
    const state = await readSiteContext(sql, siteId, at);
    await asRole(db, "authenticated", current);
    return state;
  };
  const seats = async () => {
    await db.exec("reset role");
    const rows = await sql.query<{ seat: string }>(
      `select weekday || '|' || shift_id || '#' || employee_id as seat from public.assignments where schedule_id = $1 order by 1`,
      [schedule],
    );
    await asRole(db, "authenticated", current);
    return rows.map((row) => row.seat);
  };
  return { db, sql, as, read, seats };
}

describe("shift trades in Postgres", () => {
  it("swaps two seats after the colleague and the shift manager agree", async () => {
    const { db, sql, as, read, seats } = await setup();
    const danaSeat = `0|${morning}`;
    const aviSeat = `2|${morning}`;

    await as(people.dana.user);
    const options = await swapOptions(sql, read, never, { siteId: site, week, slotKey: danaSeat });
    expect(options).toContainEqual({ slotKey: aviSeat, employeeId: people.avi.employee });
    expect(options.some((seat) => seat.employeeId === people.dana.employee)).toBe(false);
    const trade = await createTrade(sql, read, never, {
      siteId: site,
      week,
      kind: "swap",
      slotKey: danaSeat,
      target: { slotKey: aviSeat, employeeId: people.avi.employee },
    });
    expect(trade).toMatchObject({ status: "open", kind: "swap", targetId: people.avi.employee });
    await expect(
      createTrade(sql, read, never, { siteId: site, week, kind: "swap", slotKey: danaSeat, target: { slotKey: aviSeat, employeeId: people.avi.employee } }),
    ).rejects.toThrow("duplicate");
    await expect(db.query(`insert into public.shift_trades (org_id, site_id, week_start, kind, requester_id, offered_shift_id, offered_weekday)
      values ('${org}', '${site}', '${week}', 'giveaway', '${people.dana.employee}', '${morning}', 0)`)).rejects.toThrow(/permission denied/i);

    await as(people.noa.user);
    expect(await listTrades(sql)).toEqual([]);
    await expect(answerTrade(sql, read, never, { tradeId: trade.id, accept: true })).rejects.toBeInstanceOf(SaveError);

    await as(people.avi.user);
    expect((await listTrades(sql)).map((item) => item.id)).toEqual([trade.id]);
    expect((await answerTrade(sql, read, never, { tradeId: trade.id, accept: true })).status).toBe("accepted");

    await as(people.dana.user);
    await expect(decideTrade(sql, read, never, { tradeId: trade.id, approve: true, stamp: { id: crypto.randomUUID(), at: new Date().toISOString(), by: "dana" } })).rejects.toBeInstanceOf(SaveError);

    await as(manager);
    const stamp = { id: crypto.randomUUID(), at: "2026-10-24T10:00:00.000Z", by: "manager" };
    const decided = await decideTrade(sql, read, never, { tradeId: trade.id, approve: true, stamp });
    expect(decided.trade.status).toBe("approved");
    expect(await seats()).toContain(`0|${morning}#${people.avi.employee}`);
    expect(await seats()).toContain(`2|${morning}#${people.dana.employee}`);
    const versions = await sql.query<{ id: string; reason: string; number: number }>(
      `select id, reason, number from public.schedule_versions where schedule_id = $1`,
      [schedule],
    );
    expect(versions).toEqual([{ id: stamp.id, reason: "trade", number: 1 }]);
  });

  it("offers a giveaway to colleagues who can take it, and leaves the week alone when rejected", async () => {
    const { sql, as, read, seats } = await setup();
    const aviSeat = `2|${morning}`;
    const before = await seats();

    await as(people.avi.user);
    const trade = await createTrade(sql, read, never, { siteId: site, week, kind: "giveaway", slotKey: aviSeat });
    expect(trade.status).toBe("open");

    await as(people.noa.user);
    const visible = await listTrades(sql);
    expect(visible.map((item) => item.id)).toEqual([trade.id]);
    expect(await takeableTrades(sql, read, never, visible)).toEqual([]);

    await as(people.dana.user);
    const mine = await listTrades(sql);
    expect(await takeableTrades(sql, read, never, mine)).toEqual([trade.id]);
    const taken = await answerTrade(sql, read, never, { tradeId: trade.id, accept: true });
    expect(taken).toMatchObject({ status: "accepted", targetId: people.dana.employee });

    await as(people.noa.user);
    expect(await listTrades(sql)).toEqual([]);

    await as(manager);
    const decided = await decideTrade(sql, read, never, { tradeId: trade.id, approve: false, stamp: { id: crypto.randomUUID(), at: new Date().toISOString(), by: "m" } });
    expect(decided.trade.status).toBe("rejected");
    expect(await seats()).toEqual(before);

    await as(people.avi.user);
    const again = await createTrade(sql, read, never, { siteId: site, week, kind: "giveaway", slotKey: aviSeat });
    await cancelTrade(sql, again.id);
    expect((await listTrades(sql)).find((item) => item.id === again.id)?.status).toBe("cancelled");
  });
});

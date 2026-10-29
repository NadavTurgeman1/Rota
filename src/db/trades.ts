import { applyTrade, seatProblem, swapTargets, tradeProblem, type TradeKind, type TradeMove, type TradeSeat } from "../domain/trade";
import { peerDuties } from "../domain/peers";
import type { VersionStamp } from "../domain/versions";
import type { RotaState } from "../domain/types";
import { loadSiteWeek } from "./load";
import { SaveError, writeSchedule } from "./save";
import type { SqlClient } from "./types";

export type TradeStatus = "open" | "accepted" | "approved" | "rejected" | "declined" | "cancelled";

/** A swap or giveaway as the signed-in person may see it. Names come from the site roster. */
export interface ShiftTrade {
  id: string;
  siteId: string;
  week: string;
  kind: TradeKind;
  status: TradeStatus;
  requesterId: string;
  slotKey: string;
  targetId: string | null;
  targetSlotKey: string | null;
  createdAt: string;
}

/**
 * Loads a site as the rules see it: every constraint, and work at the other sites.
 * The server passes a reader that is not limited by row-level security,
 * so an employee's request is checked against colleagues they cannot see.
 */
export type SiteReader = (siteId: string, week: string) => Promise<RotaState>;

/** Hours from the week's Sunday 00:00 to now, or null when the clock does not matter. */
export type Clock = (week: string) => number | null;

interface TradeRow {
  id: string;
  site_id: string;
  week_start: string;
  kind: TradeKind;
  status: TradeStatus;
  requester_id: string;
  offered_shift_id: string;
  offered_weekday: number;
  target_id: string | null;
  target_shift_id: string | null;
  target_weekday: number | null;
  created_at: string;
}

const SELECT = `select id, site_id, to_char(week_start, 'YYYY-MM-DD') as week_start, kind, status, requester_id,
                       offered_shift_id, offered_weekday::int as offered_weekday, target_id, target_shift_id,
                       target_weekday::int as target_weekday, to_json(created_at) #>> '{}' as created_at
                from public.shift_trades`;

function fromRow(row: TradeRow): ShiftTrade {
  return {
    id: row.id,
    siteId: row.site_id,
    week: row.week_start,
    kind: row.kind,
    status: row.status,
    requesterId: row.requester_id,
    slotKey: `${row.offered_weekday}|${row.offered_shift_id}`,
    targetId: row.target_id,
    targetSlotKey: row.target_shift_id !== null && row.target_weekday !== null ? `${row.target_weekday}|${row.target_shift_id}` : null,
    createdAt: row.created_at,
  };
}

export function tradeMove(trade: ShiftTrade, takerId?: string): TradeMove {
  const from = { slotKey: trade.slotKey, employeeId: trade.requesterId };
  if (trade.kind === "swap") return { kind: "swap", from, to: { slotKey: trade.targetSlotKey ?? "", employeeId: trade.targetId ?? "" } };
  return { kind: "giveaway", from, takerId: takerId ?? trade.targetId ?? "" };
}

/** Open and recent trades for the coming weeks. Row-level security decides who sees which. */
export async function listTrades(sql: SqlClient): Promise<ShiftTrade[]> {
  const rows = await sql.query<TradeRow>(
    `${SELECT}
     where week_start >= current_date - 7
       and (status in ('open', 'accepted') or coalesce(decided_at, answered_at, created_at) > now() - interval '14 days')
     order by created_at`,
  );
  return rows.map(fromRow);
}

export async function tradeById(sql: SqlClient, tradeId: string): Promise<ShiftTrade> {
  const rows = await sql.query<TradeRow>(`${SELECT} where id = $1`, [tradeId]);
  if (!rows[0]) throw new SaveError("stale");
  return fromRow(rows[0]);
}

async function siteEmployee(sql: SqlClient, siteId: string): Promise<string> {
  const rows = await sql.query<{ id: string | null }>(`select private.site_employee($1) as id`, [siteId]);
  const id = rows[0]?.id;
  if (!id) throw new SaveError("forbidden");
  return id;
}

/** Every site of the business, so rest and hours count work elsewhere. Pass a reader without row-level security. */
export async function readSiteContext(sql: SqlClient, siteId: string, week: string): Promise<RotaState> {
  const rows = await sql.query<{ id: string }>(
    `select id from public.sites where org_id = (select org_id from public.sites where id = $1) order by created_at, name`,
    [siteId],
  );
  const sites = [];
  for (const row of rows) sites.push({ id: row.id, state: { ...(await loadSiteWeek(sql, row.id, week)), week } });
  const here = sites.find((site) => site.id === siteId);
  if (!here) throw new SaveError("site");
  return { ...here.state, siteId, peers: peerDuties(sites, siteId, week) };
}

function seatParts(slotKey: string): { weekday: number; shiftId: string } {
  const match = /^([0-6])\|([0-9a-f-]{36})$/i.exec(slotKey);
  if (!match) throw new SaveError("trade");
  return { weekday: Number(match[1]), shiftId: match[2] };
}

function translate(error: unknown): never {
  if (error instanceof SaveError) throw error;
  const message = error instanceof Error ? error.message : "";
  const code = (error as { code?: string } | null)?.code ?? "";
  if (code === "23505") throw new SaveError("duplicate");
  if (/stale/.test(message)) throw new SaveError("stale");
  if (code === "42501" || /forbidden|permission denied/i.test(message)) throw new SaveError("forbidden");
  throw new SaveError("trade");
}

/** Seats of colleagues that the signed-in employee's seat can be swapped with. */
export async function swapOptions(
  sql: SqlClient,
  read: SiteReader,
  clock: Clock,
  input: { siteId: string; week: string; slotKey: string },
): Promise<TradeSeat[]> {
  const me = await siteEmployee(sql, input.siteId);
  const state = await read(input.siteId, input.week);
  return swapTargets(state, input.week, { slotKey: input.slotKey, employeeId: me }, clock(input.week));
}

export async function createTrade(
  sql: SqlClient,
  read: SiteReader,
  clock: Clock,
  input: { siteId: string; week: string; kind: TradeKind; slotKey: string; target?: TradeSeat },
): Promise<ShiftTrade> {
  const me = await siteEmployee(sql, input.siteId);
  const from = { slotKey: input.slotKey, employeeId: me };
  const state = await read(input.siteId, input.week);
  const problem =
    input.kind === "swap"
      ? input.target
        ? tradeProblem(state, input.week, { kind: "swap", from, to: input.target }, clock(input.week))
        : { code: "seat" as const }
      : seatProblem(state, input.week, from, clock(input.week));
  if (problem) throw new SaveError("conflict");
  const offered = seatParts(input.slotKey);
  const other = input.kind === "swap" && input.target ? seatParts(input.target.slotKey) : null;
  try {
    const rows = await sql.query<{ id: string }>(
      `select private.create_shift_trade($1, $2::date, $3, $4, $5::smallint, $6, $7, $8::smallint) as id`,
      [
        input.siteId,
        input.week,
        input.kind,
        offered.shiftId,
        offered.weekday,
        other ? input.target?.employeeId ?? null : null,
        other?.shiftId ?? null,
        other?.weekday ?? null,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new SaveError("trade");
    return await tradeById(sql, id);
  } catch (error) {
    translate(error);
  }
}

/** The colleague accepts or declines a swap, or someone takes a giveaway. Taking is checked against their rules. */
export async function answerTrade(
  sql: SqlClient,
  read: SiteReader,
  clock: Clock,
  input: { tradeId: string; accept: boolean },
): Promise<ShiftTrade> {
  const trade = await tradeById(sql, input.tradeId);
  if (trade.status !== "open") throw new SaveError("stale");
  if (input.accept) {
    const me = await siteEmployee(sql, trade.siteId);
    const state = await read(trade.siteId, trade.week);
    if (tradeProblem(state, trade.week, tradeMove(trade, me), clock(trade.week))) throw new SaveError("conflict");
  }
  try {
    await sql.query(`select private.answer_shift_trade($1, $2)`, [trade.id, input.accept]);
    return await tradeById(sql, trade.id);
  } catch (error) {
    translate(error);
  }
}

export async function cancelTrade(sql: SqlClient, tradeId: string): Promise<void> {
  try {
    await sql.query(`select private.cancel_shift_trade($1)`, [tradeId]);
  } catch (error) {
    translate(error);
  }
}

/**
 * A shift manager approves or rejects. Approval checks the rules again,
 * rewrites the week and records a new version in the same transaction.
 */
export async function decideTrade(
  sql: SqlClient,
  read: SiteReader,
  clock: Clock,
  input: { tradeId: string; approve: boolean; stamp: VersionStamp },
): Promise<{ trade: ShiftTrade; move: TradeMove }> {
  const trade = await tradeById(sql, input.tradeId);
  if (trade.status !== "accepted") throw new SaveError("stale");
  const move = tradeMove(trade);
  if (input.approve) {
    const context = await read(trade.siteId, trade.week);
    if (tradeProblem(context, trade.week, move, clock(trade.week))) throw new SaveError("conflict");
    const site = await sql.query<{ org_id: string }>(`select org_id from public.sites where id = $1`, [trade.siteId]);
    const orgId = site[0]?.org_id;
    if (!orgId) throw new SaveError("forbidden");
    const current = await loadSiteWeek(sql, trade.siteId, trade.week);
    const next = applyTrade(current, trade.week, move, input.stamp);
    if (next === current) throw new SaveError("stale");
    const schedule = next.sched[trade.week];
    const people = new Set([
      ...next.emps.map((employee) => employee.id),
      ...Object.keys(next.former ?? {}),
      ...Object.values(schedule.assign).flat(),
      ...(schedule.calloffs ?? []).map((item) => item.employeeId),
    ]);
    try {
      await writeSchedule(sql, {
        orgId,
        siteId: trade.siteId,
        week: trade.week,
        schedule,
        versions: next.versions?.[trade.week] ?? [],
        shiftIds: new Set(next.biz.shifts.map((shift) => shift.id)),
        people,
      });
    } catch (error) {
      translate(error);
    }
  }
  try {
    await sql.query(`select private.decide_shift_trade($1, $2)`, [trade.id, input.approve]);
    return { trade: await tradeById(sql, trade.id), move };
  } catch (error) {
    translate(error);
  }
}

/** Open giveaways the signed-in employee could take now. */
export async function takeableTrades(sql: SqlClient, read: SiteReader, clock: Clock, trades: ShiftTrade[]): Promise<string[]> {
  const contexts = new Map<string, RotaState>();
  const found: string[] = [];
  for (const trade of trades) {
    if (trade.kind !== "giveaway" || trade.status !== "open") continue;
    const rows = await sql.query<{ id: string | null }>(`select private.site_employee($1) as id`, [trade.siteId]);
    const me = rows[0]?.id;
    if (!me || me === trade.requesterId) continue;
    const key = `${trade.siteId}|${trade.week}`;
    let state = contexts.get(key);
    if (!state) {
      state = await read(trade.siteId, trade.week);
      contexts.set(key, state);
    }
    if (!tradeProblem(state, trade.week, tradeMove(trade, me), clock(trade.week))) found.push(trade.id);
  }
  return found;
}

/** Hours since Sunday 00:00 of `week` on the Israeli clock. */
export function israelHoursIntoWeek(week: string, now = new Date()): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return (wall - Date.parse(`${week}T00:00:00Z`)) / 3_600_000;
}

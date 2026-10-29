import { SaveError } from "../../../db/save";
import {
  answerTrade,
  cancelTrade,
  createTrade,
  decideTrade,
  israelHoursIntoWeek,
  listTrades,
  readSiteContext,
  swapOptions,
  takeableTrades,
  tradeById,
  type Clock,
  type SiteReader,
} from "../../../db/trades";
import type { RotaState } from "../../../domain/types";
import { RequestClosed, supportOrgFrom, withRulesReader, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

const clock: Clock = (week) => israelHoursIntoWeek(week);

/** Loads rule context and returns it later, so the user transaction never holds a second connection. */
async function rulesFor(pairs: { siteId: string; week: string }[], signal: AbortSignal): Promise<SiteReader> {
  const wanted = [...new Map(pairs.map((pair) => [`${pair.siteId}|${pair.week}`, pair])).values()];
  if (wanted.length === 0) {
    return async () => {
      throw new SaveError("trade");
    };
  }
  const contexts = await withRulesReader(async (sql) => {
    const map = new Map<string, RotaState>();
    for (const pair of wanted) map.set(`${pair.siteId}|${pair.week}`, await readSiteContext(sql, pair.siteId, pair.week));
    return map;
  }, signal);
  return async (siteId, week) => {
    const state = contexts.get(`${siteId}|${week}`);
    if (!state) throw new SaveError("trade");
    return state;
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const SLOT = /^[0-6]\|[0-9a-f-]{36}$/i;

function failed(error: unknown): Response {
  if (error instanceof RequestClosed) return new Response(null, { status: 499 });
  if (error instanceof SaveError) {
    const status = error.message === "forbidden" ? 403 : error.message === "db_unconfigured" ? 503 : 409;
    return Response.json({ error: error.message }, { status });
  }
  console.error(error instanceof Error ? error.message : "trade request failed");
  return Response.json({ error: "save_failed" }, { status: 500 });
}

/** Trades the signed-in person may see, and the open giveaways they could take. */
export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const support = supportOrgFrom(request);
    const trades = await withUserDb(userId, (sql) => listTrades(sql), support, request.signal);
    const read = await rulesFor(
      trades.filter((trade) => trade.kind === "giveaway" && trade.status === "open").map((trade) => ({ siteId: trade.siteId, week: trade.week })),
      request.signal,
    );
    const takeable = await withUserDb(userId, (sql) => takeableTrades(sql, read, clock, trades), support, request.signal);
    return Response.json({ trades, takeable });
  } catch (error) {
    return failed(error);
  }
}

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const text = (key: string) => (typeof body?.[key] === "string" ? (body[key] as string) : "");
  const support = supportOrgFrom(request);
  try {
    if (action === "options") {
      const siteId = text("siteId");
      const week = text("week");
      const slotKey = text("slotKey");
      if (!UUID.test(siteId) || !WEEK.test(week) || !SLOT.test(slotKey)) return Response.json({ error: "trade" }, { status: 400 });
      const read = await rulesFor([{ siteId, week }], request.signal);
      const seats = await withUserDb(userId, (sql) => swapOptions(sql, read, clock, { siteId, week, slotKey }), support, request.signal);
      return Response.json({ seats });
    }
    if (action === "create") {
      const siteId = text("siteId");
      const week = text("week");
      const slotKey = text("slotKey");
      const kind = text("kind");
      const target = body?.target as { slotKey?: unknown; employeeId?: unknown } | undefined;
      const seat =
        target && typeof target.slotKey === "string" && typeof target.employeeId === "string" && SLOT.test(target.slotKey) && UUID.test(target.employeeId)
          ? { slotKey: target.slotKey, employeeId: target.employeeId }
          : undefined;
      if (!UUID.test(siteId) || !WEEK.test(week) || !SLOT.test(slotKey) || (kind !== "swap" && kind !== "giveaway")) {
        return Response.json({ error: "trade" }, { status: 400 });
      }
      const read = await rulesFor([{ siteId, week }], request.signal);
      const trade = await withUserDb(userId, (sql) => createTrade(sql, read, clock, { siteId, week, kind, slotKey, target: seat }), support, request.signal);
      return Response.json({ trade });
    }
    const tradeId = text("tradeId");
    if (!UUID.test(tradeId)) return Response.json({ error: "trade" }, { status: 400 });
    if (action === "answer" && typeof body?.accept === "boolean") {
      const accept = body.accept;
      const located = accept ? await withUserDb(userId, (sql) => tradeById(sql, tradeId), support, request.signal) : null;
      const read = located ? await rulesFor([{ siteId: located.siteId, week: located.week }], request.signal) : await rulesFor([], request.signal);
      const trade = await withUserDb(userId, (sql) => answerTrade(sql, read, clock, { tradeId, accept }), support, request.signal);
      return Response.json({ trade });
    }
    if (action === "cancel") {
      await withUserDb(userId, (sql) => cancelTrade(sql, tradeId), support, request.signal);
      return Response.json({ ok: true });
    }
    if (action === "decide" && typeof body?.approve === "boolean") {
      const approve = body.approve;
      const by = text("by").slice(0, 120);
      const stamp = { id: crypto.randomUUID(), at: new Date().toISOString(), by };
      const located = approve ? await withUserDb(userId, (sql) => tradeById(sql, tradeId), support, request.signal) : null;
      const read = located ? await rulesFor([{ siteId: located.siteId, week: located.week }], request.signal) : await rulesFor([], request.signal);
      const decided = await withUserDb(userId, (sql) => decideTrade(sql, read, clock, { tradeId, approve, stamp }), support, request.signal);
      return Response.json({ ...decided, stamp });
    }
    return Response.json({ error: "trade" }, { status: 400 });
  } catch (error) {
    return failed(error);
  }
}

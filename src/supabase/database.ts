import postgres from "postgres";
import type { SqlClient } from "../db/types";
import { SaveError } from "../db/save";

type Database = ReturnType<typeof postgres>;

/** The client went away. The transaction must roll back and free its connection. */
export class RequestClosed extends Error {
  constructor() {
    super("closed");
    this.name = "RequestClosed";
  }
}

type PoolSlot = { url: string; db: Database };

const globalPools = globalThis as typeof globalThis & { __rotaDb?: PoolSlot };

function database(): Database | null {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) return null;
  const existing = globalPools.__rotaDb;
  if (existing?.url === url) return existing.db;
  if (existing) void existing.db.end({ timeout: 5 });
  // Turbopack loads this module once per route. One app server shares this pool.
  // The URL has to be the transaction pooler (port 6543): session mode allows
  // 15 clients for the whole project.
  const db = postgres(url, {
    prepare: false,
    max: 4,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });
  globalPools.__rotaDb = { url, db };
  return db;
}

function closed(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RequestClosed();
}

/**
 * Runs queries as the signed-in user so the existing row-level policies apply.
 * The connection string stays on the server.
 */
const SUPPORT_ORG = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a platform admin header is applied, and only inside this transaction. */
export function supportOrgFrom(request: Request): string | null {
  const value = request.headers.get("x-rota-support-org")?.trim() ?? "";
  return SUPPORT_ORG.test(value) ? value : null;
}

/**
 * A read-only transaction that row-level security does not limit.
 * Only for checking a request against rules the signed-in person may not read.
 * Call it after the person's own access was checked, and never return its rows.
 */
export async function withRulesReader<T>(run: (sql: SqlClient) => Promise<T>, signal?: AbortSignal): Promise<T> {
  const db = database();
  if (!db) throw new SaveError("db_unconfigured");
  closed(signal);
  return db.begin(async (tx) => {
    closed(signal);
    await tx.unsafe("set transaction read only");
    const sql: SqlClient = {
      async query<Row>(text: string, params?: readonly unknown[]): Promise<Row[]> {
        closed(signal);
        const rows = await tx.unsafe(text, (params ? [...params] : []) as never[]);
        closed(signal);
        return [...rows] as Row[];
      },
    };
    return run(sql);
  }) as Promise<T>;
}

export async function withUserDb<T>(
  userId: string,
  run: (sql: SqlClient) => Promise<T>,
  supportOrgId?: string | null,
  signal?: AbortSignal,
): Promise<T> {
  const db = database();
  if (!db) throw new SaveError("db_unconfigured");
  closed(signal);
  return db.begin(async (tx) => {
    closed(signal);
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    closed(signal);
    await tx.unsafe("set local role authenticated");
    if (supportOrgId && SUPPORT_ORG.test(supportOrgId)) {
      const admin = await tx<{ admin: boolean }[]>`select private.is_platform_admin() as admin`;
      closed(signal);
      if (admin[0]?.admin === true) await tx`select set_config('app.support_org', ${supportOrgId}, true)`;
    }
    const sql: SqlClient = {
      async query<Row>(text: string, params?: readonly unknown[]): Promise<Row[]> {
        closed(signal);
        const rows = await tx.unsafe(text, (params ? [...params] : []) as never[]);
        closed(signal);
        return [...rows] as Row[];
      },
    };
    return run(sql);
  }) as Promise<T>;
}

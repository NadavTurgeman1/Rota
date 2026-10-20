import postgres from "postgres";
import type { SqlClient } from "../db/types";
import { SaveError } from "../db/save";

type Database = ReturnType<typeof postgres>;

let pool: Database | null = null;

function database(): Database | null {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) return null;
  pool ??= postgres(url, { prepare: false, max: 4, ssl: "require" });
  return pool;
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
export async function withRulesReader<T>(run: (sql: SqlClient) => Promise<T>): Promise<T> {
  const db = database();
  if (!db) throw new SaveError("db_unconfigured");
  return db.begin(async (tx) => {
    await tx.unsafe("set transaction read only");
    const sql: SqlClient = {
      async query<Row>(text: string, params?: readonly unknown[]): Promise<Row[]> {
        const rows = await tx.unsafe(text, (params ? [...params] : []) as never[]);
        return [...rows] as Row[];
      },
    };
    return run(sql);
  }) as Promise<T>;
}

export async function withUserDb<T>(userId: string, run: (sql: SqlClient) => Promise<T>, supportOrgId?: string | null): Promise<T> {
  const db = database();
  if (!db) throw new SaveError("db_unconfigured");
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.unsafe("set local role authenticated");
    if (supportOrgId && SUPPORT_ORG.test(supportOrgId)) {
      const admin = await tx<{ admin: boolean }[]>`select private.is_platform_admin() as admin`;
      if (admin[0]?.admin === true) await tx`select set_config('app.support_org', ${supportOrgId}, true)`;
    }
    const sql: SqlClient = {
      async query<Row>(text: string, params?: readonly unknown[]): Promise<Row[]> {
        const rows = await tx.unsafe(text, (params ? [...params] : []) as never[]);
        return [...rows] as Row[];
      },
    };
    return run(sql);
  }) as Promise<T>;
}

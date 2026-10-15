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
export async function withUserDb<T>(userId: string, run: (sql: SqlClient) => Promise<T>): Promise<T> {
  const db = database();
  if (!db) throw new SaveError("db_unconfigured");
  return db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx.unsafe("set local role authenticated");
    const sql: SqlClient = {
      async query<Row>(text: string, params?: readonly unknown[]): Promise<Row[]> {
        const rows = await tx.unsafe(text, (params ? [...params] : []) as never[]);
        return [...rows] as Row[];
      },
    };
    return run(sql);
  }) as Promise<T>;
}

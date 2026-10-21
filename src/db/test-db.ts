import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type { SqlClient } from "./types";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const authStub = `
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb
  );
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
  end $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`;

const migrations = join(root, "supabase/migrations");

function migrationFiles(): string[] {
  const files = readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) {
    if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
      throw new Error(`Invalid migration filename: ${name}`);
    }
  }
  return files;
}

/** Applies every migration and the demo seed. The connection is the table owner. */
export async function openTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(authStub);
  for (const name of migrationFiles()) await db.exec(readFileSync(join(migrations, name), "utf8"));
  await db.exec(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
  return db;
}

/** Applies the migrations that come before `name`, without the seed, and returns a way to apply `name`. */
export async function openDatabaseBefore(name: string): Promise<{ db: PGlite; apply: () => Promise<void> }> {
  const files = migrationFiles();
  const target = files.find((file) => file.endsWith(`_${name}.sql`));
  if (!target) throw new Error(`Unknown migration: ${name}`);
  const db = new PGlite();
  await db.exec(authStub);
  for (const file of files.slice(0, files.indexOf(target))) await db.exec(readFileSync(join(migrations, file), "utf8"));
  return { db, apply: () => db.exec(readFileSync(join(migrations, target), "utf8")).then(() => undefined) };
}

export function client(db: PGlite): SqlClient {
  return {
    async query<T>(sql: string, params?: readonly unknown[]): Promise<T[]> {
      const result = await db.query<T>(sql, params ? [...params] : []);
      return result.rows;
    },
  };
}

export async function asRole(db: PGlite, role: "authenticated" | "anon", userId = "") {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId]);
  await db.exec(`set role ${role}`);
}

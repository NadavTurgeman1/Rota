import { SaveError } from "./save";
import type { SqlClient } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(error: unknown, fallback: string): never {
  if (error instanceof SaveError) throw error;
  const message = error instanceof Error ? error.message : "";
  if (/forbidden|42501/i.test(message)) throw new SaveError("forbidden");
  if (/\bwindow\b/i.test(message)) throw new SaveError("window");
  if (/\bavailability\b/i.test(message)) throw new SaveError("availability");
  throw new SaveError(fallback);
}

function stamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const time = Date.parse(value);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  throw new SaveError("window");
}

/** A manager lets one employee ignore the block cap for one week, or takes that back. */
export async function saveConstraintGrant(
  sql: SqlClient,
  input: { siteId: string; employeeId: string; week: string; allowed: boolean },
): Promise<void> {
  if (!UUID.test(input.siteId) || !UUID.test(input.employeeId) || !/^\d{4}-\d{2}-\d{2}$/.test(input.week)) {
    throw new SaveError("availability");
  }
  try {
    await sql.query(`select private.set_constraint_grant($1, $2, $3::date, $4)`, [
      input.siteId,
      input.employeeId,
      input.week,
      input.allowed,
    ]);
  } catch (error) {
    fail(error, "availability");
  }
}

/** Open an extra submission window. The deadline is the database clock plus the chosen minutes. */
export async function openConstraintExtension(sql: SqlClient, input: { siteId: string; minutes: number }): Promise<string> {
  if (!UUID.test(input.siteId) || !Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > 1439) {
    throw new SaveError("window");
  }
  try {
    const rows = await sql.query<{ until: unknown }>(`select private.open_constraint_extension($1, $2) as until`, [
      input.siteId,
      input.minutes,
    ]);
    return stamp(rows[0]?.until);
  } catch (error) {
    fail(error, "window");
  }
}

/** Drop exception toggles after the submission window has closed. A permanent window that is still open is left alone. */
export async function clearClosedConstraintGrants(sql: SqlClient, siteId: string): Promise<void> {
  if (!UUID.test(siteId)) throw new SaveError("window");
  try {
    await sql.query(`select private.clear_closed_constraint_grants($1)`, [siteId]);
  } catch (error) {
    fail(error, "window");
  }
}

/** Close the extra submission window. */
export async function closeConstraintExtension(sql: SqlClient, siteId: string): Promise<void> {
  if (!UUID.test(siteId)) throw new SaveError("window");
  try {
    await sql.query(`select private.close_constraint_extension($1)`, [siteId]);
  } catch (error) {
    fail(error, "window");
  }
}

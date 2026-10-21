import { sundayOnOrBefore } from "../../../domain";
import {
  canCreateBusiness,
  createFirstOrganization,
  createFirstSite,
  loadStoredWorkspace,
  platformAdmin,
  saveStoredWorkspace,
  suspendedTenantName,
} from "../../../db/workspace-store";
import { SaveError } from "../../../db/save";
import type { Workspace } from "../../../workspace/workspace";
import { supportOrgFrom, withUserDb } from "../../../supabase/database";
import { userIdFromAuthorization } from "../../../supabase/user";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const access = await withUserDb(userId, async (sql) => {
      const workspace = await loadStoredWorkspace(sql, jerusalemSunday());
      return {
        workspace,
        admin: await platformAdmin(sql),
        canCreateBusiness: workspace ? false : await canCreateBusiness(sql),
        suspended: workspace ? null : await suspendedTenantName(sql),
      };
    }, supportOrgFrom(request));
    return Response.json(access);
  } catch (error) {
    return databaseError(error);
  }
}

export async function PUT(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const workspace = readWorkspace(await readJson(request));
  if (!workspace) return Response.json({ error: "bad_request" }, { status: 400 });
  try {
    await withUserDb(userId, (sql) => saveStoredWorkspace(sql, workspace), supportOrgFrom(request));
    return Response.json({ ok: true });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const userId = await userIdFromAuthorization(request.headers.get("authorization"));
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  const siteName = typeof body?.siteName === "string" ? body.siteName : "";
  const name = typeof body?.name === "string" ? body.name : "";
  const type = typeof body?.type === "string" ? body.type : "";
  try {
    const workspace = await withUserDb(userId, (sql) => {
      if (siteName.trim() && !name.trim()) return createFirstSite(sql, { name: siteName });
      if (name.trim() && !siteName.trim()) return createFirstOrganization(sql, { name, type });
      throw new SaveError("bad_request");
    }, supportOrgFrom(request));
    return Response.json({ workspace });
  } catch (error) {
    return databaseError(error);
  }
}

function jerusalemSunday(now = new Date()): string {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return sundayOnOrBefore(iso);
}

async function readJson(request: Request): Promise<{ name?: unknown; type?: unknown; siteName?: unknown; org?: unknown; sites?: unknown; activeSiteId?: unknown } | null> {
  try {
    return (await request.json()) as {
      name?: unknown;
      type?: unknown;
      siteName?: unknown;
      org?: unknown;
      sites?: unknown;
      activeSiteId?: unknown;
    };
  } catch {
    return null;
  }
}

function readWorkspace(body: { org?: unknown; sites?: unknown; activeSiteId?: unknown } | null): Workspace | null {
  if (!body || !body.org || typeof body.org !== "object" || !Array.isArray(body.sites)) return null;
  const org = body.org as { id?: unknown; name?: unknown; type?: unknown; hebrewCalendar?: unknown };
  if (typeof org.id !== "string" || typeof org.name !== "string" || typeof org.type !== "string") return null;
  return {
    org: { id: org.id, name: org.name, type: org.type, hebrewCalendar: org.hebrewCalendar !== false },
    sites: body.sites as Workspace["sites"],
    activeSiteId: typeof body.activeSiteId === "string" ? body.activeSiteId : "",
    users: [],
  };
}

function databaseError(error: unknown): Response {
  if (error instanceof SaveError && error.message === "db_unconfigured") {
    return Response.json({ error: "db_unconfigured" }, { status: 503 });
  }
  if (error instanceof SaveError && (error.message === "forbidden" || error.message === "site")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (error instanceof SaveError) return Response.json({ error: error.message }, { status: 400 });
  console.error(error instanceof Error ? error.message : "workspace request failed");
  return Response.json({ error: "save_failed" }, { status: 500 });
}

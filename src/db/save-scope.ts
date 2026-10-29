import type { RotaState } from "../domain/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which pieces of one site the next save has to write. */
export type SiteScope = {
  biz: boolean;
  people: boolean;
  availability: boolean;
  notes: boolean;
  /** Schedule weeks to rewrite. */
  weeks: string[];
  /** Schedule weeks to remove. */
  removedWeeks: string[];
};

/** Which pieces of the open company the next save has to write. */
export type SaveScope = {
  org: boolean;
  sites: Record<string, SiteScope>;
};

type SavedSite = { id: string; state: RotaState };
type SavedWorkspace = {
  org: { name: string; type: string; hebrewCalendar?: boolean };
  sites: SavedSite[];
};

function isSunday(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;
}

function stable(value: unknown): string {
  return JSON.stringify(order(value));
}

function order(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(order);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, order((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function weeksOf(state: RotaState): string[] {
  return Object.keys(state.sched).filter(isSunday).sort();
}

function sliceBiz(state: RotaState): string {
  return stable(state.biz);
}

function slicePeople(state: RotaState): string {
  return stable({ emps: state.emps, former: state.former ?? {} });
}

function sliceAvailability(state: RotaState): string {
  return stable(state.avail);
}

function sliceNotes(state: RotaState): string {
  return stable(state.notes ?? {});
}

function sliceWeek(state: RotaState, week: string): string {
  return stable({ schedule: state.sched[week], versions: state.versions?.[week] ?? [] });
}

function shiftKey(state: RotaState): string {
  return state.biz.shifts.map((shift) => shift.id).join("\n");
}

function fullSite(state: RotaState): SiteScope {
  return {
    biz: true,
    people: true,
    availability: true,
    notes: true,
    weeks: weeksOf(state),
    removedWeeks: [],
  };
}

function emptySite(): SiteScope {
  return { biz: false, people: false, availability: false, notes: false, weeks: [], removedWeeks: [] };
}

/** Nothing to write when the persisted slices match. The open week and the active site do not count. */
export function diffWorkspace(before: SavedWorkspace | null, after: SavedWorkspace): SaveScope | null {
  if (!before) {
    return {
      org: true,
      sites: Object.fromEntries(after.sites.map((site) => [site.id, fullSite(site.state)])),
    };
  }
  const scope: SaveScope = {
    org:
      before.org.name !== after.org.name ||
      before.org.type !== after.org.type ||
      (before.org.hebrewCalendar !== false) !== (after.org.hebrewCalendar !== false),
    sites: {},
  };
  const previous = new Map(before.sites.map((site) => [site.id, site]));
  for (const site of after.sites) {
    const older = previous.get(site.id);
    if (!older) {
      scope.sites[site.id] = fullSite(site.state);
      continue;
    }
    const next = emptySite();
    const shiftsChanged = shiftKey(older.state) !== shiftKey(site.state);
    next.biz = sliceBiz(older.state) !== sliceBiz(site.state);
    next.people = slicePeople(older.state) !== slicePeople(site.state);
    next.availability = sliceAvailability(older.state) !== sliceAvailability(site.state);
    next.notes = sliceNotes(older.state) !== sliceNotes(site.state);
    const olderWeeks = new Set(weeksOf(older.state));
    const newerWeeks = weeksOf(site.state);
    if (shiftsChanged) {
      next.weeks = newerWeeks;
      next.removedWeeks = [...olderWeeks].filter((week) => !newerWeeks.includes(week));
    } else {
      next.weeks = newerWeeks.filter((week) => !olderWeeks.has(week) || sliceWeek(older.state, week) !== sliceWeek(site.state, week));
      next.removedWeeks = [...olderWeeks].filter((week) => !newerWeeks.includes(week));
    }
    if (next.biz || next.people || next.availability || next.notes || next.weeks.length > 0 || next.removedWeeks.length > 0) {
      scope.sites[site.id] = next;
    }
  }
  if (!scope.org && Object.keys(scope.sites).length === 0) return null;
  return scope;
}

/** Scope for the snapshot about to be sent, compared with the last one the server has. */
export function scopeForSave(ackedJson: string, nextJson: string): SaveScope | null {
  let before: SavedWorkspace | null = null;
  if (ackedJson) {
    try {
      before = JSON.parse(ackedJson) as SavedWorkspace;
    } catch {
      before = null;
    }
  }
  return diffWorkspace(before, JSON.parse(nextJson) as SavedWorkspace);
}

/** `undefined` when the body is a full save. `null` when the scope is present and unusable. */
export function parseSaveScope(value: unknown): SaveScope | undefined | null {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as { org?: unknown; sites?: unknown };
  if (typeof body.org !== "boolean" || !body.sites || typeof body.sites !== "object" || Array.isArray(body.sites)) return null;
  const sites: SaveScope["sites"] = {};
  for (const [id, raw] of Object.entries(body.sites as Record<string, unknown>)) {
    if (!UUID.test(id) || !raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const site = raw as Record<string, unknown>;
    if (typeof site.biz !== "boolean" || typeof site.people !== "boolean" || typeof site.availability !== "boolean" || typeof site.notes !== "boolean") {
      return null;
    }
    if (!Array.isArray(site.weeks) || !Array.isArray(site.removedWeeks)) return null;
    if (!site.weeks.every((item) => typeof item === "string") || !site.removedWeeks.every((item) => typeof item === "string")) return null;
    sites[id] = {
      biz: site.biz,
      people: site.people,
      availability: site.availability,
      notes: site.notes,
      weeks: site.weeks,
      removedWeeks: site.removedWeeks,
    };
  }
  return { org: body.org, sites };
}

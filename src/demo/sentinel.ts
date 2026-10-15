import { sundayOnOrBefore, type Employee, type RotaState } from "../domain";
import type { Workspace } from "../workspace/workspace";

/** Fixed ids from supabase/seed.sql. The schedule screen starts from this, not from a live database. */
export const SENTINEL = {
  orgId: "11111111-1111-4111-8111-111111111111",
  orgName: "Sentinel Security",
  siteId: "22222222-2222-4222-8222-222222222222",
  siteName: "Headquarters",
  morning: "33333333-3333-4333-8333-333333333301",
  afternoon: "33333333-3333-4333-8333-333333333302",
  night: "33333333-3333-4333-8333-333333333303",
  dana: "44444444-4444-4444-8444-444444444401",
  yossi: "44444444-4444-4444-8444-444444444402",
  maya: "44444444-4444-4444-8444-444444444403",
  omer: "44444444-4444-4444-8444-444444444404",
  noa: "44444444-4444-4444-8444-444444444405",
  eli: "44444444-4444-4444-8444-444444444406",
  tal: "44444444-4444-4444-8444-444444444407",
  ron: "44444444-4444-4444-8444-444444444408",
} as const;

/** Sunday of the week containing 14 Oct 2026. Safe for the first server render. */
export const SENTINEL_FALLBACK_WEEK = "2026-10-11";

const ALL = [SENTINEL.morning, SENTINEL.afternoon, SENTINEL.night];

function agreement(shifts: string[], closedDays: number[] = []): string[][] {
  const closed = new Set(closedDays);
  return [0, 1, 2, 3, 4, 5, 6].map((day) => (closed.has(day) ? [] : [...shifts]));
}

function guard(id: string, name: string, perWeek: number, grid: string[][], pref: string[] = []): Employee {
  return {
    id,
    name,
    contact: `${name.toLowerCase()}@example.com`,
    role: "Guard",
    quals: "",
    perWeek,
    maxHours: 0,
    pref,
    active: true,
    grid,
  };
}

/** In-memory copy of the Sentinel seed, shaped the way `toRotaState` builds it. */
export function sentinelState(week: string): RotaState {
  const dayAndNight = agreement(ALL);
  return {
    week: sundayOnOrBefore(week),
    biz: {
      name: SENTINEL.siteName,
      type: "Security company",
      minRest: 11,
      maxHours: 48,
      maxShift: 12,
      assume: true,
      shifts: [
        {
          id: SENTINEL.morning,
          name: "Morning",
          start: "06:00",
          end: "14:00",
          role: "",
          req: [2, 2, 2, 2, 2, 2, 2],
        },
        {
          id: SENTINEL.afternoon,
          name: "Afternoon",
          start: "14:00",
          end: "22:00",
          role: "",
          req: [2, 2, 2, 2, 2, 2, 2],
        },
        {
          id: SENTINEL.night,
          name: "Night",
          start: "22:00",
          end: "06:00",
          role: "",
          req: [1, 1, 1, 1, 1, 1, 1],
        },
      ],
    },
    emps: [
      guard(SENTINEL.dana, "Dana", 4, agreement([SENTINEL.morning, SENTINEL.afternoon])),
      guard(SENTINEL.eli, "Eli", 4, agreement([SENTINEL.afternoon, SENTINEL.night])),
      guard(SENTINEL.maya, "Maya", 5, agreement(ALL, [6]), [SENTINEL.morning]),
      guard(SENTINEL.noa, "Noa", 5, dayAndNight),
      guard(SENTINEL.omer, "Omer", 5, dayAndNight, [SENTINEL.night]),
      guard(SENTINEL.ron, "Ron", 4, agreement(ALL, [5])),
      guard(SENTINEL.tal, "Tal", 4, dayAndNight),
      guard(SENTINEL.yossi, "Yossi", 5, dayAndNight),
    ],
    avail: {
      "2026-10-04": {
        [SENTINEL.dana]: [[...ALL], [...ALL], [], [], [], [], []],
      },
    },
    sched: {},
    closed: {},
  };
}

/** A second demo site. It exists only in the browser demo, not in `supabase/seed.sql`. */
export const HARBOR = {
  siteId: "22222222-2222-4222-8222-222222222223",
  day: "33333333-3333-4333-8333-333333333311",
  night: "33333333-3333-4333-8333-333333333312",
  avi: "44444444-4444-4444-8444-444444444411",
  lior: "44444444-4444-4444-8444-444444444412",
  shani: "44444444-4444-4444-8444-444444444413",
  gal: "44444444-4444-4444-8444-444444444414",
} as const;

export function harborState(week: string): RotaState {
  const both = agreement([HARBOR.day, HARBOR.night]);
  return {
    week: sundayOnOrBefore(week),
    biz: {
      name: "Harbor",
      type: "Security company",
      minRest: 11,
      maxHours: 48,
      maxShift: 12,
      assume: true,
      shifts: [
        { id: HARBOR.day, name: "Day", start: "07:00", end: "19:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
        { id: HARBOR.night, name: "Night", start: "19:00", end: "07:00", role: "", req: [1, 1, 1, 1, 1, 1, 1] },
      ],
    },
    emps: [
      guard(HARBOR.avi, "Avi", 4, both),
      guard(HARBOR.gal, "Gal", 3, agreement([HARBOR.day])),
      guard(HARBOR.lior, "Lior", 4, both, [HARBOR.night]),
      guard(HARBOR.shani, "Shani", 3, agreement([HARBOR.day, HARBOR.night], [5, 6])),
    ],
    avail: {},
    sched: {},
    closed: {},
  };
}

export const DEMO_PASSWORD = "demo1234";

export const DEMO_USERS = [{ id: "55555555-5555-4555-8555-555555555501", name: "Ari", email: "owner@sentinel.demo", access: "owner" }] as const;

/** `headquarters` replaces the seeded first site, for carrying over an older demo save. */
export function sentinelWorkspace(week: string, headquarters: RotaState = sentinelState(week)): Workspace {
  return {
    org: { id: SENTINEL.orgId, name: SENTINEL.orgName, type: "Security company" },
    sites: [
      { id: SENTINEL.siteId, state: headquarters },
      { id: HARBOR.siteId, state: harborState(headquarters.week) },
    ],
    activeSiteId: SENTINEL.siteId,
    users: DEMO_USERS.map((user) => ({ ...user, password: DEMO_PASSWORD })),
  };
}

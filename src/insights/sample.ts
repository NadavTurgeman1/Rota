import type { RotaState } from "../domain";

export type Risk = "low" | "medium" | "high";

export interface PersonInsight {
  id: string;
  name: string;
  shifts: number;
  hours: number;
  quota: number;
  doubles: number;
  nights: number;
  /** Shifts as a share of the agreed weekly quota, in percent. */
  load: number;
  risk: Risk;
}

export interface DayStaffing {
  day: number;
  needed: number;
  available: number;
}

export type AnomalyKind = "nightStreak" | "overQuota" | "shortRest" | "lateSwaps" | "underUsed";

export interface Anomaly {
  kind: AnomalyKind;
  name: string;
  value: number;
  day: number;
}

export type TipKind = "spreadNights" | "hireForDay" | "rebalance" | "reduceDoubles";

export interface Tip {
  kind: TipKind;
  name: string;
  other: string;
  day: number;
  value: number;
}

export interface SampleInsights {
  coverage: number;
  hours: number;
  doubles: number;
  atRisk: number;
  /** Positive: people beyond what the week needs. Negative: missing people. */
  balance: number;
  people: PersonInsight[];
  days: DayStaffing[];
  anomalies: Anomaly[];
  tips: Tip[];
}

/** Stable pseudo-random numbers, so the same week always shows the same sample. */
function seeded(seed: string): () => number {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  };
}

/**
 * Illustrative figures only, nothing here is computed from the schedule.
 * Only people still on the site appear, so a deleted employee never shows up.
 */
export function sampleInsights(state: RotaState): SampleInsights {
  const random = seeded(`${state.week}|${state.emps.map((employee) => employee.id).join(",")}`);
  const between = (low: number, high: number) => low + Math.floor(random() * (high - low + 1));
  const roster = state.emps.map((employee) => ({ id: employee.id, name: employee.name, quota: employee.perWeek || 5 }));
  roster.sort(() => random() - 0.5);

  /** Someone over quota and someone under it, so every anomaly and tip below reads true. */
  const spread = [2, -2, 1, 0, -1];
  const people = roster.map((person, index): PersonInsight => {
    const shifts = Math.max(1, person.quota + spread[index % spread.length]);
    const doubles = index === 0 ? between(1, 2) : random() < 0.3 ? 1 : 0;
    const nights = between(0, Math.min(4, shifts));
    const load = Math.round((shifts / person.quota) * 100);
    const score = load / 100 + doubles * 0.25 + nights * 0.12;
    const risk: Risk = score >= 1.45 ? "high" : score >= 1.1 ? "medium" : "low";
    return { id: person.id, name: person.name, shifts, hours: shifts * 8 + doubles * 4, quota: person.quota, doubles, nights, load, risk };
  });
  people.sort((left, right) => right.load - left.load);

  const days = [0, 1, 2, 3, 4, 5, 6].map((day): DayStaffing => {
    const needed = state.biz.shifts.reduce((sum, shift) => sum + Number(shift.req[day] || 0), 0) || between(3, 6);
    return { day, needed, available: Math.max(0, needed + between(-2, 2)) };
  });

  const tightest = days.reduce((low, day) => (day.available - day.needed < low.available - low.needed ? day : low), days[0]);
  const anomalies: Anomaly[] = [];
  const tips: Tip[] = [];
  if (tightest.available < tightest.needed) {
    tips.push({ kind: "hireForDay", name: "", other: "", day: tightest.day, value: tightest.needed - tightest.available });
  }
  if (people.length > 0) {
    const busiest = people[0];
    const pick = () => people[between(0, people.length - 1)].name;
    anomalies.push(
      { kind: "nightStreak", name: busiest.name, value: Math.max(3, busiest.nights), day: between(0, 6) },
      { kind: "overQuota", name: busiest.name, value: Math.max(1, busiest.shifts - busiest.quota), day: 0 },
      { kind: "shortRest", name: pick(), value: between(6, 8), day: between(0, 6) },
      { kind: "lateSwaps", name: pick(), value: between(2, 4), day: 0 },
    );
    tips.push({ kind: "reduceDoubles", name: "", other: "", day: 0, value: people.reduce((sum, person) => sum + person.doubles, 0) });
  }
  if (people.length > 1) {
    const busiest = people[0];
    const calmest = people[people.length - 1];
    anomalies.push({ kind: "underUsed", name: calmest.name, value: Math.max(1, calmest.quota - calmest.shifts), day: 0 });
    tips.unshift(
      { kind: "spreadNights", name: busiest.name, other: calmest.name, day: 0, value: 0 },
      { kind: "rebalance", name: busiest.name, other: calmest.name, day: 0, value: between(1, 2) },
    );
  }

  const needed = days.reduce((sum, day) => sum + day.needed, 0);
  const available = days.reduce((sum, day) => sum + Math.min(day.needed, day.available), 0);
  const surplus = days.reduce((sum, day) => sum + day.available - day.needed, 0);
  return {
    coverage: needed ? Math.round((available / needed) * 100) : 100,
    hours: people.reduce((sum, person) => sum + person.hours, 0),
    doubles: people.reduce((sum, person) => sum + person.doubles, 0),
    atRisk: people.filter((person) => person.risk === "high").length,
    balance: Math.round(surplus / 2),
    people,
    days,
    anomalies,
    tips,
  };
}

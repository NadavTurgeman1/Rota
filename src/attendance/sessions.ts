import type { Lang } from "../domain";

export type AttendancePunch = {
  id: string;
  siteId: string;
  siteName: string;
  kind: "in" | "out";
  punchedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export type AttendanceSession = {
  in: AttendancePunch | null;
  out: AttendancePunch | null;
};

/** Pair each clock-in with the following clock-out. Newest session first. */
export function pairPunches(punches: AttendancePunch[]): AttendanceSession[] {
  const ordered = [...punches].sort((left, right) => left.punchedAt.localeCompare(right.punchedAt) || left.id.localeCompare(right.id));
  const sessions: AttendanceSession[] = [];
  for (const punch of ordered) {
    const open = sessions.at(-1);
    if (punch.kind === "in") sessions.push({ in: punch, out: null });
    else if (open && open.in && !open.out) open.out = punch;
    else sessions.push({ in: null, out: punch });
  }
  return sessions.reverse();
}

export function formatWhen(iso: string, timeZone: string, lang: Lang): { date: string; time: string } {
  const at = new Date(iso);
  const locale = lang === "he" ? "he-IL" : "en-GB";
  return {
    date: new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", year: "numeric" }).format(at),
    time: new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at),
  };
}

export function formatDuration(fromIso: string, toIso: string, lang: Lang): string {
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return lang === "he" ? `${hours} שע׳ ${String(rest).padStart(2, "0")} דק׳` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

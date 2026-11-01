import { absenceOnDate } from "../domain/absence";
import { wallInstant } from "../domain/messages";
import { staffedCount } from "../domain/rest";
import { effectiveSlot } from "../domain/schedule";
import { heldRoles } from "../domain/rules";
import { addDays, durationHours, formatClock, parseClock, sundayOnOrBefore, type RotaState } from "../domain";

const ON_TIME_MS = 60_000;
const EARLY_MS = 3 * 60 * 60 * 1000;

export type ReportPunch = {
  id: string;
  employeeId: string;
  siteId: string;
  kind: "in" | "out";
  punchedAt: string;
};

export type ReportSite = {
  id: string;
  name: string;
  timeZone: string;
  state: RotaState;
  /** Null when punches for this site are not loaded. */
  punches: ReportPunch[] | null;
};

export type ReportFilters = {
  from: string;
  to: string;
  siteId: string;
  employeeId: string;
  role: string;
};

export type HoursRow = {
  key: string;
  employeeId: string;
  name: string;
  role: string;
  siteName: string;
  date: string;
  inAt: string | null;
  outAt: string | null;
  minutes: number | null;
};

export type PayrollIssue = "missing-in" | "late" | "missing-out" | "early-out";

export type PayrollStatus = "standard" | "exception" | "absence" | "waiting" | "unknown";

export type PayrollRow = {
  key: string;
  employeeId: string;
  name: string;
  siteName: string;
  date: string;
  shiftName: string;
  role: string;
  standardStart: string;
  standardEnd: string;
  inAt: string | null;
  outAt: string | null;
  status: PayrollStatus;
  issues: PayrollIssue[];
  lateMinutes: number;
  earlyOutMinutes: number;
  absence: "sick" | "vacation" | null;
};

export type StandardRow = {
  key: string;
  siteName: string;
  date: string;
  shiftName: string;
  role: string;
  required: number;
  assigned: number;
  clocked: number | null;
  /** Clock-ins when the shift has started and punches are loaded. Otherwise the published assignment. */
  compared: "clock" | "schedule";
  gap: number;
};

type Seat = {
  id: string;
  employeeId: string;
  name: string;
  siteId: string;
  siteName: string;
  date: string;
  shiftId: string;
  shiftName: string;
  role: string;
  startAt: number;
  endAt: number;
  standardStart: string;
  standardEnd: string;
};

type Position = {
  key: string;
  siteId: string;
  siteName: string;
  date: string;
  shiftId: string;
  shiftName: string;
  role: string;
  required: number;
  assigned: string[];
  startAt: number;
};

function chosen(sites: ReportSite[], filters: ReportFilters): ReportSite[] {
  return filters.siteId ? sites.filter((site) => site.id === filters.siteId) : sites;
}

function holdsRole(employee: { role: string; secondaryRoles?: string[] }, role: string): boolean {
  const needle = role.trim().toLowerCase();
  if (!needle) return true;
  return heldRoles(employee).some((item) => item.toLowerCase() === needle);
}

function roleMatches(shiftRole: string, role: string): boolean {
  const needle = role.trim().toLowerCase();
  if (!needle) return true;
  return shiftRole.trim().toLowerCase() === needle;
}

function zonedDate(at: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(at));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

function instant(date: string, hour: number, timeZone: string): number {
  const clock = formatClock(hour);
  const day = addDays(date, Math.floor(hour / 24));
  return Date.parse(wallInstant(day, clock, timeZone));
}

function punchesOf(sites: ReportSite[]): ReportPunch[] {
  const seen = new Set<string>();
  const rows: ReportPunch[] = [];
  for (const site of sites) {
    for (const punch of site.punches ?? []) {
      if (seen.has(punch.id)) continue;
      seen.add(punch.id);
      rows.push(punch);
    }
  }
  return rows;
}

function people(site: ReportSite): Map<string, { name: string; role: string; secondaryRoles?: string[] }> {
  return new Map(site.state.emps.map((employee) => [employee.id, employee]));
}

/** Clock-ins and clock-outs in the range, one row per session. */
export function buildHours(sites: ReportSite[], filters: ReportFilters): HoursRow[] {
  const rows: HoursRow[] = [];
  for (const site of chosen(sites, filters)) {
    const directory = people(site);
    const byPerson = new Map<string, ReportPunch[]>();
    for (const punch of site.punches ?? []) {
      const list = byPerson.get(punch.employeeId) ?? [];
      list.push(punch);
      byPerson.set(punch.employeeId, list);
    }
    for (const [employeeId, list] of byPerson) {
      const employee = directory.get(employeeId);
      if (!employee) continue;
      if (filters.employeeId && employeeId !== filters.employeeId) continue;
      if (!holdsRole(employee, filters.role)) continue;
      const ordered = [...list].sort((left, right) => left.punchedAt.localeCompare(right.punchedAt) || left.id.localeCompare(right.id));
      const sessions: { inAt: string | null; outAt: string | null }[] = [];
      for (const punch of ordered) {
        const open = sessions.at(-1);
        if (punch.kind === "in") sessions.push({ inAt: punch.punchedAt, outAt: null });
        else if (open?.inAt && !open.outAt) open.outAt = punch.punchedAt;
        else sessions.push({ inAt: null, outAt: punch.punchedAt });
      }
      for (const session of sessions) {
        const anchor = Date.parse(session.inAt ?? session.outAt ?? "");
        if (!Number.isFinite(anchor)) continue;
        const date = zonedDate(anchor, site.timeZone);
        if (date < filters.from || date > filters.to) continue;
        const inMs = session.inAt ? Date.parse(session.inAt) : Number.NaN;
        const outMs = session.outAt ? Date.parse(session.outAt) : Number.NaN;
        rows.push({
          key: `${site.id}|${employeeId}|${session.inAt ?? ""}|${session.outAt ?? ""}`,
          employeeId,
          name: employee.name,
          role: employee.role,
          siteName: site.name,
          date,
          inAt: session.inAt,
          outAt: session.outAt,
          minutes: Number.isFinite(inMs) && Number.isFinite(outMs) ? Math.max(0, Math.round((outMs - inMs) / 60_000)) : null,
        });
      }
    }
  }
  rows.sort((left, right) => left.name.localeCompare(right.name, "he") || left.date.localeCompare(right.date) || (left.inAt ?? "").localeCompare(right.inAt ?? ""));
  return rows;
}

function positions(site: ReportSite, filters: ReportFilters): Position[] {
  const rows: Position[] = [];
  const { state } = site;
  for (let week = sundayOnOrBefore(filters.from); week <= filters.to; week = addDays(week, 7)) {
    const schedule = state.sched[week];
    if (!schedule) continue;
    for (const shift of state.biz.shifts) {
      if (!roleMatches(shift.role, filters.role)) continue;
      for (let day = 0; day < 7; day += 1) {
        const date = addDays(week, day);
        if (date < filters.from || date > filters.to) continue;
        const key = `${day}|${shift.id}`;
        const override = schedule.staffing?.[key];
        const required = override !== undefined && Number.isFinite(override) ? Math.trunc(override) : staffedCount(shift, day, week);
        const assigned = [...new Set(schedule.assign[key] ?? [])];
        if (required <= 0 && assigned.length === 0) continue;
        if (filters.employeeId && !assigned.includes(filters.employeeId)) continue;
        const start = day * 24 + parseClock(shift.start);
        let startAt = Number.NaN;
        try {
          startAt = instant(week, start, site.timeZone);
        } catch {
          startAt = Number.NaN;
        }
        rows.push({
          key: `${site.id}|${week}|${key}`,
          siteId: site.id,
          siteName: site.name,
          date,
          shiftId: shift.id,
          shiftName: shift.name,
          role: shift.role,
          required: Math.max(0, required),
          assigned,
          startAt,
        });
      }
    }
  }
  return rows;
}

function seats(site: ReportSite, filters: ReportFilters): Seat[] {
  const directory = people(site);
  const rows: Seat[] = [];
  const { state } = site;
  for (let week = sundayOnOrBefore(filters.from); week <= filters.to; week = addDays(week, 7)) {
    const schedule = state.sched[week];
    if (!schedule) continue;
    for (const shift of state.biz.shifts) {
      for (let day = 0; day < 7; day += 1) {
        const date = addDays(week, day);
        if (date < filters.from || date > filters.to) continue;
        const key = `${day}|${shift.id}`;
        const start = day * 24 + parseClock(shift.start);
        const slot = { key, day, shiftId: shift.id, start, end: start + durationHours(shift.start, shift.end), required: 0 };
        const seen = new Set<string>();
        for (const employeeId of schedule.assign[key] ?? []) {
          if (seen.has(employeeId)) continue;
          seen.add(employeeId);
          const employee = directory.get(employeeId);
          if (!employee) continue;
          if (filters.employeeId && employeeId !== filters.employeeId) continue;
          if (!roleMatches(shift.role, filters.role)) continue;
          const effective = effectiveSlot(schedule, slot, employeeId);
          let startAt = Number.NaN;
          let endAt = Number.NaN;
          try {
            startAt = instant(week, effective.start, site.timeZone);
            endAt = instant(week, effective.end, site.timeZone);
          } catch {
            continue;
          }
          if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) continue;
          rows.push({
            id: `${site.id}|${week}|${key}|${employeeId}`,
            employeeId,
            name: employee.name,
            siteId: site.id,
            siteName: site.name,
            date,
            shiftId: shift.id,
            shiftName: shift.name,
            role: shift.role || employee.role,
            startAt,
            endAt,
            standardStart: formatClock(effective.start),
            standardEnd: formatClock(effective.end),
          });
        }
      }
    }
  }
  return rows;
}

function matchIns(rows: Seat[], punches: ReportPunch[]): Map<string, ReportPunch> {
  const claimed = new Map<string, ReportPunch>();
  const taken = new Set<string>();
  const byPerson = new Map<string, Seat[]>();
  for (const seat of rows) {
    const list = byPerson.get(seat.employeeId) ?? [];
    list.push(seat);
    byPerson.set(seat.employeeId, list);
  }
  const clocks = punches
    .filter((punch) => punch.kind === "in")
    .sort((left, right) => left.punchedAt.localeCompare(right.punchedAt) || left.id.localeCompare(right.id));
  for (const punch of clocks) {
    const at = Date.parse(punch.punchedAt);
    if (!Number.isFinite(at)) continue;
    const open = (byPerson.get(punch.employeeId) ?? []).filter((seat) => !taken.has(seat.id));
    const during = open.filter((seat) => at >= seat.startAt && at <= seat.endAt).sort((left, right) => right.startAt - left.startAt);
    const upcoming = open.filter((seat) => at >= seat.startAt - EARLY_MS && at < seat.startAt).sort((left, right) => left.startAt - right.startAt);
    const seat = during[0] ?? upcoming[0];
    if (!seat) continue;
    taken.add(seat.id);
    claimed.set(seat.id, punch);
  }
  return claimed;
}

function outAfter(punches: ReportPunch[], employeeId: string, inAt: string): string | null {
  const next = punches
    .filter((punch) => punch.employeeId === employeeId && punch.punchedAt > inAt)
    .sort((left, right) => left.punchedAt.localeCompare(right.punchedAt) || left.id.localeCompare(right.id))[0];
  return next?.kind === "out" ? next.punchedAt : null;
}

/** Each assigned shift against its clock-in and clock-out. A covered shift keeps the standard hours. */
export function buildPayroll(sites: ReportSite[], filters: ReportFilters, now: Date): PayrollRow[] {
  const rows: PayrollRow[] = [];
  const nowMs = now.getTime();
  for (const site of chosen(sites, filters)) {
    const siteSeats = seats(site, filters);
    const punches = site.punches;
    const claims = punches ? matchIns(siteSeats, punches) : new Map<string, ReportPunch>();
    for (const seat of siteSeats) {
      const absence = absenceOnDate(site.state.absences, seat.employeeId, seat.date);
      if (!punches) {
        rows.push(payrollRow(seat, null, null, "unknown", [], 0, 0, absence));
        continue;
      }
      const punch = claims.get(seat.id);
      const inAt = punch?.punchedAt ?? null;
      const outAt = inAt ? outAfter(punches, seat.employeeId, inAt) : null;
      if (!inAt && absence) {
        rows.push(payrollRow(seat, null, null, "absence", [], 0, 0, absence));
        continue;
      }
      if (!inAt && nowMs < seat.startAt) {
        rows.push(payrollRow(seat, null, null, "waiting", [], 0, 0, null));
        continue;
      }
      const issues: PayrollIssue[] = [];
      let lateMinutes = 0;
      let earlyOutMinutes = 0;
      if (!inAt) issues.push("missing-in");
      else {
        const delta = Date.parse(inAt) - seat.startAt;
        if (delta > ON_TIME_MS) {
          issues.push("late");
          lateMinutes = Math.round(delta / 60_000);
        }
      }
      if (inAt && !outAt && nowMs >= seat.endAt) issues.push("missing-out");
      else if (inAt && !outAt && nowMs < seat.endAt && issues.length === 0) {
        rows.push(payrollRow(seat, inAt, null, "waiting", [], 0, 0, null));
        continue;
      }
      if (outAt) {
        const early = seat.endAt - Date.parse(outAt);
        if (early > ON_TIME_MS) {
          issues.push("early-out");
          earlyOutMinutes = Math.round(early / 60_000);
        }
      }
      rows.push(payrollRow(seat, inAt, outAt, issues.length > 0 ? "exception" : "standard", issues, lateMinutes, earlyOutMinutes, null));
    }
  }
  rows.sort((left, right) => left.name.localeCompare(right.name, "he") || left.date.localeCompare(right.date) || left.standardStart.localeCompare(right.standardStart));
  return rows;
}

function payrollRow(
  seat: Seat,
  inAt: string | null,
  outAt: string | null,
  status: PayrollStatus,
  issues: PayrollIssue[],
  lateMinutes: number,
  earlyOutMinutes: number,
  absence: "sick" | "vacation" | null,
): PayrollRow {
  return {
    key: seat.id,
    employeeId: seat.employeeId,
    name: seat.name,
    siteName: seat.siteName,
    date: seat.date,
    shiftName: seat.shiftName,
    role: seat.role,
    standardStart: seat.standardStart,
    standardEnd: seat.standardEnd,
    inAt,
    outAt,
    status,
    issues,
    lateMinutes,
    earlyOutMinutes,
    absence,
  };
}

/** The payroll rows that are not the standard: a missed, late, or short clock. */
export function buildErrors(sites: ReportSite[], filters: ReportFilters, now: Date): PayrollRow[] {
  return buildPayroll(sites, filters, now).filter((row) => row.status === "exception");
}

/** Required headcount against who was assigned and who clocked in, per position and day. */
export function buildStandard(sites: ReportSite[], filters: ReportFilters, now: Date): StandardRow[] {
  const rows: StandardRow[] = [];
  const nowMs = now.getTime();
  for (const site of chosen(sites, filters)) {
    const siteSeats = seats(site, { ...filters, employeeId: "", role: "" });
    const claims = site.punches ? matchIns(siteSeats, site.punches) : new Map<string, ReportPunch>();
    for (const position of positions(site, filters)) {
      const started = Number.isFinite(position.startAt) && nowMs >= position.startAt;
      const compared = site.punches && started ? "clock" : "schedule";
      let clocked: number | null = null;
      if (compared === "clock") {
        clocked = position.assigned.filter((employeeId) =>
          siteSeats.some((seat) => seat.date === position.date && seat.shiftId === position.shiftId && seat.employeeId === employeeId && claims.has(seat.id)),
        ).length;
      }
      const actual = clocked ?? position.assigned.length;
      rows.push({
        key: position.key,
        siteName: position.siteName,
        date: position.date,
        shiftName: position.shiftName,
        role: position.role,
        required: position.required,
        assigned: position.assigned.length,
        clocked,
        compared,
        gap: actual - position.required,
      });
    }
  }
  rows.sort((left, right) => left.date.localeCompare(right.date) || left.siteName.localeCompare(right.siteName, "he") || left.shiftName.localeCompare(right.shiftName, "he"));
  return rows;
}

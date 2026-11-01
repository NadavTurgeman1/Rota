import postgres from "postgres";
import { randomUUID } from "node:crypto";

const ORG = "a1111111-1111-4111-8111-111111111111";
const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL missing");

const sql = postgres(url, { prepare: false, ssl: "require", max: 1, connect_timeout: 30 });

const clock = await sql`select current_date::text as today, now() as now`;
const TODAY = clock[0].today;
const NOW = new Date(clock[0].now);
const WINDOW_START = addMonths(TODAY, -6);
const FIRST_WEEK = sundayOnOrBefore(WINDOW_START);

function addDays(iso, days) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function addMonths(iso, months) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, day));
  return date.toISOString().slice(0, 10);
}

function sundayOnOrBefore(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const [ay, am, ad] = from.split("-").map(Number);
  const [by, bm, bd] = to.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

function parseClock(value) {
  const [hours, minutes] = String(value).split(":");
  return Number(hours) + Number(minutes) / 60;
}

function offsetMinutes(date, hour) {
  if (date > "2026-03-27" && date < "2026-10-25") return 180;
  if (date === "2026-10-25" && hour < 2) return 180;
  return 120;
}

function atLocal(date, minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - offsetMinutes(date, hour) / 60, minute, 0)).toISOString();
}

function weeksFrom(start, today) {
  const weeks = [];
  for (let week = start; week <= today; week = addDays(week, 7)) weeks.push(week);
  return weeks;
}

function bandOf(name) {
  if (name.startsWith("בוקר")) return 0;
  if (name.startsWith("צהריים")) return 1;
  return 2;
}

function clipRange(start, end) {
  if (end < WINDOW_START || start > TODAY) return null;
  const clippedStart = start < WINDOW_START ? WINDOW_START : start;
  const clippedEnd = end > TODAY ? TODAY : end;
  if (clippedStart > clippedEnd) return null;
  return { start: clippedStart, end: clippedEnd };
}

function overlaps(ranges, start, end) {
  return ranges.some((range) => range.start <= end && start <= range.end);
}

const SICK_NOTES = ["חום וכאבי גרון", "שפעת", "כאבי גב", "דלקת גרון", "מיגרנה"];
const VACATION_NOTES = ["חופשה שנתית", "חופשה משפחתית", "אירוע משפחתי", "יום נישואין"];
const CONSTRAINT_NOTES = [
  "לא יכול/ה ביום שלישי בערב — חוג קבוע.",
  "מבקש/ת לא לשבץ לילה באמצע השבוע.",
  "יש סידור קבוע ביום ראשון בבוקר.",
  "צריך לצאת מוקדם ביום חמישי.",
];

const sites = await sql`
  select id, name, timezone, min_rest_hours::float8 as min_rest
  from public.sites
  where org_id = ${ORG}
  order by name
`;
const shiftRows = await sql`
  select s.id, s.site_id, s.name, s.starts_at::text as starts_at, s.ends_at::text as ends_at, s.required_role,
         r.weekday::int as weekday, r.required_count::int as required_count
  from public.shifts s
  join public.shift_requirements r on r.shift_id = s.id
  where s.org_id = ${ORG}
  order by s.site_id, s.position, r.weekday
`;
const people = await sql`
  select id, name, job_title, home_site_id, weekly_shift_quota::int as quota, email
  from public.employees
  where org_id = ${ORG} and schedulable = true
  order by name
`;
const links = await sql`
  select employee_id, site_id from public.employee_sites where org_id = ${ORG}
`;
const agreementRows = await sql`
  select a.employee_id, a.shift_id, a.weekday::int as weekday, s.site_id
  from public.employee_agreements a
  join public.shifts s on s.id = a.shift_id
  where a.org_id = ${ORG}
`;
const managers = await sql`
  select id, name, home_site_id, email
  from public.employees
  where org_id = ${ORG} and job_title = ${"מנהל אתר"}
`;

const shiftsBySite = new Map();
for (const row of shiftRows) {
  const siteShifts = shiftsBySite.get(row.site_id) ?? new Map();
  const shift = siteShifts.get(row.id) ?? {
    id: row.id,
    siteId: row.site_id,
    name: row.name,
    role: row.required_role,
    band: bandOf(row.name),
    start: parseClock(row.starts_at),
    end: parseClock(row.ends_at),
    required: [0, 0, 0, 0, 0, 0, 0],
  };
  if (shift.end <= shift.start) shift.end += 24;
  shift.required[row.weekday] = row.required_count;
  siteShifts.set(row.id, shift);
  shiftsBySite.set(row.site_id, siteShifts);
}
for (const [siteId, map] of shiftsBySite) shiftsBySite.set(siteId, [...map.values()]);

const siteOf = new Map(sites.map((site) => [site.id, site]));
const managerOf = new Map();
for (const manager of managers) {
  const current = managerOf.get(manager.home_site_id);
  if (!current || manager.email.startsWith("manager")) managerOf.set(manager.home_site_id, manager);
}

const workers = people.map((person, index) => ({
  id: person.id,
  name: person.name,
  role: person.job_title,
  home: person.home_site_id,
  quota: person.quota || 5,
  band: person.job_title === "אחמש" ? null : index % 3,
  sites: [],
  ranges: [],
}));
const workerById = new Map(workers.map((worker) => [worker.id, worker]));
for (const link of links) workerById.get(link.employee_id)?.sites.push(link.site_id);
for (const site of sites) {
  const crew = workers.filter((worker) => worker.home === site.id && worker.band !== null);
  for (const role of ["חמוש", "סיור"]) {
    crew
      .filter((worker) => worker.role === role)
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .forEach((worker, index) => {
        worker.band = index % 3;
      });
  }
}

const agreements = new Map();
for (const row of agreementRows) {
  const key = `${row.employee_id}|${row.site_id}`;
  const cells = agreements.get(key) ?? [];
  cells.push({ shiftId: row.shift_id, weekday: row.weekday });
  agreements.set(key, cells);
}

const coords = new Map(sites.map((site) => [site.id, site.name.includes("צפון") ? [32.8191, 34.9896] : [31.2518, 34.7913]]));
const minRest = Math.max(...sites.map((site) => Number(site.min_rest) || 0), 0);
const weeks = weeksFrom(FIRST_WEEK, TODAY);
const lastShift = new Map();
const weekCount = new Map();

function absent(employeeId, date) {
  const worker = workerById.get(employeeId);
  return worker.ranges.some((range) => range.status === "approved" && range.start <= date && date <= range.end);
}

function countKey(employeeId, week) {
  return `${employeeId}|${week}`;
}

function gapOk(employeeId, date, start, end) {
  const previous = lastShift.get(employeeId);
  if (!previous) return true;
  const gap = daysBetween(previous.date, date) * 24 + start - previous.end;
  return gap >= minRest - 0.01;
}

function restAgainst(employeeId, date, start, end) {
  for (const row of assignments) {
    if (row.employee_id !== employeeId) continue;
    const otherStart = daysBetween(date, row.date) * 24 + row.start;
    const otherEnd = daysBetween(date, row.date) * 24 + row.end;
    const gap = otherEnd <= start ? start - otherEnd : end <= otherStart ? otherStart - end : -1;
    if (gap < minRest - 0.01) return false;
  }
  return true;
}

function remember(employeeId, date, end) {
  const previous = lastShift.get(employeeId);
  if (!previous || date > previous.date || (date === previous.date && end > previous.end)) {
    lastShift.set(employeeId, { date, end });
  }
}

const absences = [];
for (const site of sites) {
  const armed = workers.filter((worker) => worker.home === site.id && worker.role === "חמוש");
  const patrol = workers.filter((worker) => worker.home === site.id && worker.role === "סיור");
  const commanders = workers.filter((worker) => worker.home === site.id && worker.role === "אחמש");
  weeks.forEach((week, weekIndex) => {
    const plan = [];
    if (weekIndex % 2 === 0 && armed.length) {
      plan.push({ person: armed[weekIndex % armed.length], start: addDays(week, 1), end: addDays(week, 2), kind: "sick" });
    }
    if (weekIndex % 4 === 1 && patrol.length) {
      plan.push({ person: patrol[weekIndex % patrol.length], start: week, end: addDays(week, 4), kind: "vacation" });
    }
    if (weekIndex % 6 === 3 && commanders.length) {
      plan.push({
        person: commanders[weekIndex % commanders.length],
        start: addDays(week, 3),
        end: addDays(week, 3),
        kind: "sick",
      });
    }
    for (const item of plan) {
      const range = clipRange(item.start, item.end);
      if (!range || overlaps(item.person.ranges, range.start, range.end)) continue;
      const record = {
        id: randomUUID(),
        org_id: ORG,
        site_id: site.id,
        employee_id: item.person.id,
        kind: item.kind,
        start_date: range.start,
        end_date: range.end,
        note: item.kind === "sick" ? SICK_NOTES[weekIndex % SICK_NOTES.length] : VACATION_NOTES[weekIndex % VACATION_NOTES.length],
        status: "approved",
        created_at: atLocal(addDays(range.start, -1), 9 * 60),
        decided_at: atLocal(addDays(range.start, -1), 11 * 60),
      };
      if (record.created_at > NOW.toISOString()) continue;
      item.person.ranges.push({ start: range.start, end: range.end, status: "approved" });
      absences.push(record);
    }
  });
}

for (const site of sites) {
  const crew = workers.filter((worker) => worker.home === site.id);
  const rejectedPerson = crew[2];
  const openPerson = crew[5];
  const rejected = clipRange("2026-06-08", "2026-06-09");
  if (rejected && rejectedPerson && !overlaps(rejectedPerson.ranges, rejected.start, rejected.end)) {
    absences.push({
      id: randomUUID(),
      org_id: ORG,
      site_id: site.id,
      employee_id: rejectedPerson.id,
      kind: "vacation",
      start_date: rejected.start,
      end_date: rejected.end,
      note: "חופשה שלא אושרה",
      status: "rejected",
      created_at: atLocal(addDays(rejected.start, -3), 10 * 60),
      decided_at: atLocal(addDays(rejected.start, -2), 15 * 60),
    });
  }
  const openStart = addDays(TODAY, -3);
  if (openPerson && openStart >= WINDOW_START && !overlaps(openPerson.ranges, openStart, openStart)) {
    absences.push({
      id: randomUUID(),
      org_id: ORG,
      site_id: site.id,
      employee_id: openPerson.id,
      kind: "sick",
      start_date: openStart,
      end_date: openStart,
      note: "ממתין לאישור",
      status: "open",
      created_at: atLocal(openStart, 8 * 60),
      decided_at: null,
    });
  }
}

const schedules = [];
const assignments = [];
const extensions = [];
const calloffs = [];
const versions = [];
const trades = [];
const staffing = [];
const availabilityWeeks = [];
const availabilityEntries = [];
const requests = [];
const notes = [];
const grants = [];
const punches = [];

const busy = new Set();

function canTake(worker, date, start, end, week, { over = false } = {}) {
  if (absent(worker.id, date)) return false;
  if (busy.has(`${worker.id}|${date}`)) return false;
  const used = weekCount.get(countKey(worker.id, week)) ?? 0;
  const homeCap = worker.sites.length > 1 ? worker.quota - 1 : worker.quota;
  if (!over && used >= homeCap && worker.home) return false;
  if (over && used >= worker.quota + 1) return false;
  if (!over && used >= worker.quota) return false;
  return gapOk(worker.id, date, start, end);
}

function place(worker, seat, week, flags = {}) {
  const row = {
    org_id: ORG,
    schedule_id: seat.scheduleId,
    shift_id: seat.shift.id,
    weekday: seat.weekday,
    employee_id: worker.id,
    locked: flags.locked === true,
    over_quota: flags.over === true,
    date: seat.date,
    start: seat.shift.start,
    end: seat.shift.end,
    site_id: seat.shift.siteId,
    role: seat.shift.role,
  };
  assignments.push(row);
  busy.add(`${worker.id}|${seat.date}`);
  weekCount.set(countKey(worker.id, week), (weekCount.get(countKey(worker.id, week)) ?? 0) + 1);
  remember(worker.id, seat.date, seat.shift.end);
  return row;
}

for (const [weekIndex, week] of weeks.entries()) {
  const weekEnd = addDays(week, 6);
  const fullPast = weekEnd <= TODAY;
  const weekRows = [];
  const dropped = [];
  for (const site of sites) {
    const scheduleId = randomUUID();
    schedules.push({
      id: scheduleId,
      org_id: ORG,
      site_id: site.id,
      week_start: week,
      status: "published",
    });
    const siteShifts = shiftsBySite.get(site.id) ?? [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      const date = addDays(week, weekday);
      if (date < WINDOW_START || date > TODAY) continue;
      for (const shift of siteShifts) {
        let need = shift.required[weekday] ?? 0;
        const hole =
          fullPast &&
          weekday === (weekIndex * 2 + ["חמוש", "סיור", "אחמש"].indexOf(shift.role)) % 7 &&
          shift.band === (weekIndex + shift.role.length) % 3;
        if (hole && need > 0) {
          need -= 1;
          dropped.push({ scheduleId, shift, weekday, date, siteId: site.id });
        }
        const pool = workers.filter(
          (worker) => worker.home === site.id && worker.role === shift.role && (worker.band === null || worker.band === shift.band),
        );
        const ranked = [...pool].sort((a, b) => {
          const used = (weekCount.get(countKey(a.id, week)) ?? 0) - (weekCount.get(countKey(b.id, week)) ?? 0);
          return used || a.name.localeCompare(b.name, "he");
        });
        for (const worker of ranked) {
          if (need <= 0) break;
          if (!canTake(worker, date, shift.start, shift.end, week)) continue;
          const row = place(worker, { scheduleId, shift, weekday, date }, week, { locked: weekday === 0 && need === shift.required[weekday] });
          weekRows.push(row);
          need -= 1;
        }
      }
    }
  }

  if (weekIndex % 2 === 1) {
    for (const site of sites) {
      let placedRelief = 0;
      for (const hole of dropped.filter((seat) => seat.siteId === site.id)) {
        if (placedRelief >= 2) break;
        const already = weekRows.filter(
          (row) => row.schedule_id === hole.scheduleId && row.shift_id === hole.shift.id && row.weekday === hole.weekday,
        ).length;
        if (already >= (hole.shift.required[hole.weekday] ?? 0)) continue;
        const worker = workers.find((candidate) => {
          const used = weekCount.get(countKey(candidate.id, week)) ?? 0;
          return (
            candidate.home !== site.id &&
            candidate.sites.includes(site.id) &&
            candidate.role === hole.shift.role &&
            (candidate.band === null || candidate.band === hole.shift.band) &&
            used < candidate.quota &&
            !absent(candidate.id, hole.date) &&
            !busy.has(`${candidate.id}|${hole.date}`) &&
            restAgainst(candidate.id, hole.date, hole.shift.start, hole.shift.end)
          );
        });
        if (!worker) continue;
        weekRows.push(place(worker, hole, week));
        placedRelief += 1;
      }
    }
  }

  if (fullPast && weekIndex % 4 === 0) {
    for (const site of sites) {
      const hole = dropped.find((seat) => seat.siteId === site.id && !weekRows.some((row) => row.schedule_id === seat.scheduleId && row.shift_id === seat.shift.id && row.weekday === seat.weekday && row.employee_id));
      const open = dropped.find(
        (seat) =>
          seat.siteId === site.id &&
          !weekRows.some((row) => row.shift_id === seat.shift.id && row.weekday === seat.weekday && row.schedule_id === seat.scheduleId && row.site_id === site.id && row.over_quota),
      );
      const target = open ?? hole;
      if (!target) continue;
      const already = weekRows.filter((row) => row.schedule_id === target.scheduleId && row.shift_id === target.shift.id && row.weekday === target.weekday).length;
      if (already >= (target.shift.required[target.weekday] ?? 0)) continue;
      const worker = workers.find(
        (candidate) =>
          candidate.home === site.id &&
          candidate.role === target.shift.role &&
          (candidate.band === null || candidate.band === target.shift.band) &&
          (weekCount.get(countKey(candidate.id, week)) ?? 0) === candidate.quota &&
          !absent(candidate.id, target.date) &&
          !busy.has(`${candidate.id}|${target.date}`) &&
          gapOk(candidate.id, target.date, target.shift.start, target.shift.end),
      );
      if (!worker) continue;
      const row = place(worker, target, week, { over: true });
      weekRows.push(row);
    }
  }

  if (fullPast) {
    for (const site of sites) {
      const row = weekRows.find(
        (item) => item.site_id === site.id && item.weekday > 0 && item.shift_id && bandOf(shiftsBySite.get(site.id).find((shift) => shift.id === item.shift_id)?.name ?? "") === 0,
      );
      if (!row) continue;
      row.end += 1;
      row.hours = { start: row.weekday * 24 + row.start, end: row.weekday * 24 + row.end };
    }
  }

  const before = weekRows.map((row) => ({ ...row }));
  let tradedSite = null;
  const weekCalloffs = [];
  if (fullPast && weekIndex % 3 === 1) {
    const pair = findSwap(weekRows);
    if (pair) {
      const requester = pair.left.employee_id;
      const offeredShift = pair.left.shift_id;
      const offeredDay = pair.left.weekday;
      const target = pair.right.employee_id;
      const targetShift = pair.right.shift_id;
      const targetDay = pair.right.weekday;
      swapPeople(pair.left, pair.right);
      tradedSite = pair.left.site_id;
      trades.push({
        id: randomUUID(),
        org_id: ORG,
        site_id: pair.left.site_id,
        week_start: week,
        kind: "swap",
        requester_id: requester,
        offered_shift_id: offeredShift,
        offered_weekday: offeredDay,
        target_id: target,
        target_shift_id: targetShift,
        target_weekday: targetDay,
        status: "approved",
        created_at: atLocal(addDays(week, 1), 8 * 60),
        answered_at: atLocal(addDays(week, 1), 9 * 60),
        decided_at: atLocal(addDays(week, 1), 10 * 60),
      });
    }
  } else if (fullPast && weekIndex % 3 === 2) {
    for (const site of sites) {
      const row = weekRows.find((item) => item.site_id === site.id && !item.hours && item.weekday === 2) ?? weekRows.find((item) => item.site_id === site.id && !item.hours);
      if (!row) continue;
      const manager = managerOf.get(site.id);
      const when = atLocal(row.date, Math.max(0, (row.start - 2) * 60));
      const calloff = {
        id: randomUUID(),
        org_id: ORG,
        schedule_id: row.schedule_id,
        shift_id: row.shift_id,
        weekday: row.weekday,
        employee_id: row.employee_id,
        reported_at: when,
        reported_by_name: manager?.name ?? "מנהל",
        name: workerById.get(row.employee_id)?.name ?? "",
        slotKey: `${row.weekday}|${row.shift_id}`,
      };
      weekCalloffs.push(calloff);
      calloffs.push(calloff);
      busy.delete(`${row.employee_id}|${row.date}`);
      const index = weekRows.indexOf(row);
      if (index >= 0) weekRows.splice(index, 1);
      const kept = assignments.indexOf(row);
      if (kept >= 0) assignments.splice(kept, 1);
    }
  }

  if (fullPast && weekIndex % 4 === 2) {
    for (const site of sites) {
      const sameShift = weekRows.filter((item) => item.site_id === site.id);
      const pair = findSwap(sameShift);
      if (!pair) continue;
      trades.push({
        id: randomUUID(),
        org_id: ORG,
        site_id: site.id,
        week_start: week,
        kind: "swap",
        requester_id: pair.left.employee_id,
        offered_shift_id: pair.left.shift_id,
        offered_weekday: pair.left.weekday,
        target_id: pair.right.employee_id,
        target_shift_id: pair.right.shift_id,
        target_weekday: pair.right.weekday,
        status: "declined",
        created_at: atLocal(addDays(week, 2), 12 * 60),
        answered_at: atLocal(addDays(week, 2), 13 * 60),
        decided_at: null,
      });
      break;
    }
  }

  for (const schedule of schedules.filter((item) => item.week_start === week)) {
    const rows = weekRows.filter((row) => row.schedule_id === schedule.id);
    const beforeRows = before.filter((row) => row.schedule_id === schedule.id);
    const siteCalloffs = weekCalloffs.filter((calloff) => calloff.schedule_id === schedule.id);
    const manager = managerOf.get(schedule.site_id);
    versions.push({
      id: randomUUID(),
      org_id: ORG,
      schedule_id: schedule.id,
      number: 1,
      reason: "publish",
      restored_from: null,
      author_name: manager?.name ?? "מנהל",
      snapshot: snapshot(beforeRows, []),
      created_at: atLocal(addDays(week, -2), 11 * 60),
    });
    const tradeHere = tradedSite === schedule.site_id;
    if (siteCalloffs.length || tradeHere) {
      versions.push({
        id: randomUUID(),
        org_id: ORG,
        schedule_id: schedule.id,
        number: 2,
        reason: siteCalloffs.length ? "calloff" : "trade",
        restored_from: null,
        author_name: manager?.name ?? "מנהל",
        snapshot: snapshot(rows, siteCalloffs),
        created_at: atLocal(addDays(week, 1), 10 * 60 + 30),
      });
    }
  }
}

function findSwap(rows) {
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const left = rows[leftIndex];
      const right = rows[rightIndex];
      if (left.site_id !== right.site_id || left.shift_id !== right.shift_id) continue;
      if (left.weekday === right.weekday || left.employee_id === right.employee_id) continue;
      if (busy.has(`${left.employee_id}|${right.date}`) || busy.has(`${right.employee_id}|${left.date}`)) continue;
      if (absent(left.employee_id, right.date) || absent(right.employee_id, left.date)) continue;
      return { left, right };
    }
  }
  return null;
}

function swapPeople(left, right) {
  busy.delete(`${left.employee_id}|${left.date}`);
  busy.delete(`${right.employee_id}|${right.date}`);
  const employeeId = left.employee_id;
  left.employee_id = right.employee_id;
  right.employee_id = employeeId;
  busy.add(`${left.employee_id}|${left.date}`);
  busy.add(`${right.employee_id}|${right.date}`);
}

function snapshot(rows, rowCalloffs) {
  const assign = {};
  const locked = [];
  const over = {};
  const hours = {};
  for (const row of rows) {
    const key = `${row.weekday}|${row.shift_id}`;
    (assign[key] ??= []).push(row.employee_id);
    if (row.locked) locked.push(`${key}#${row.employee_id}`);
    if (row.over_quota) over[`${key}#${row.employee_id}`] = true;
    if (row.hours) hours[`${key}#${row.employee_id}`] = row.hours;
  }
  return {
    assign,
    locked,
    status: "published",
    ...(Object.keys(hours).length ? { hours } : {}),
    ...(Object.keys(over).length ? { over } : {}),
    ...(rowCalloffs.length
      ? {
          calloffs: rowCalloffs.map((calloff) => ({
            id: calloff.id,
            slotKey: calloff.slotKey,
            employeeId: calloff.employee_id,
            name: calloff.name,
            at: calloff.reported_at,
            by: calloff.reported_by_name,
          })),
        }
      : {}),
  };
}

for (const row of assignments) {
  if (!row.hours) continue;
  extensions.push({
    org_id: ORG,
    schedule_id: row.schedule_id,
    shift_id: row.shift_id,
    weekday: row.weekday,
    employee_id: row.employee_id,
    start_hour: row.hours.start,
    end_hour: row.hours.end,
    group_id: "hours",
    cover_shift_id: row.shift_id,
    cover_weekday: row.weekday,
    group_size: 1,
  });
}

let punchSerial = 0;
for (const row of assignments) {
  const shift = (shiftsBySite.get(row.site_id) ?? []).find((item) => item.id === row.shift_id);
  if (!shift) continue;
  const late = punchSerial % 5 === 0 ? 8 + (punchSerial % 12) : 0;
  const startMinute = Math.round(shift.start * 60) + late;
  const endClock = row.hours ? row.end : shift.end;
  const endMinute = Math.round((endClock % 24) * 60);
  const endDate = endClock >= 24 ? addDays(row.date, 1) : row.date;
  const inAt = atLocal(row.date, startMinute);
  const outAt = atLocal(endDate, endMinute);
  if (inAt > NOW.toISOString()) continue;
  const [latitude, longitude] = coords.get(row.site_id) ?? [32.07, 34.78];
  const base = {
    org_id: ORG,
    site_id: row.site_id,
    employee_id: row.employee_id,
    device_offset_minutes: offsetMinutes(row.date, shift.start),
    latitude: Math.round((latitude + ((punchSerial % 9) - 4) * 0.0002) * 1e6) / 1e6,
    longitude: Math.round((longitude + ((punchSerial % 7) - 3) * 0.0002) * 1e6) / 1e6,
    accuracy_meters: 8 + (punchSerial % 18),
  };
  punches.push({
    ...base,
    id: randomUUID(),
    kind: "in",
    punched_at: inAt,
    device_at: inAt,
  });
  if (outAt <= NOW.toISOString()) {
    punches.push({
      ...base,
      id: randomUUID(),
      kind: "out",
      punched_at: outAt,
      device_at: outAt,
      device_offset_minutes: offsetMinutes(endDate, endClock % 24),
    });
  }
  punchSerial += 1;
}

for (const [weekIndex, week] of weeks.entries()) {
  for (const worker of workers) {
    for (const siteId of worker.sites) {
      const cells = agreements.get(`${worker.id}|${siteId}`) ?? [];
      if (!cells.length) continue;
      const weekId = randomUUID();
      const assigned = new Set(
        assignments.filter((row) => row.employee_id === worker.id && row.site_id === siteId && row.date >= week && row.date <= addDays(week, 6)).map((row) => `${row.weekday}|${row.shift_id}`),
      );
      const workedDays = new Set([...assigned].map((key) => Number(key.split("|")[0])));
      let blocked = null;
      for (let step = 0; step < 7; step += 1) {
        const day = (weekIndex + worker.name.length + step) % 7;
        if (workedDays.has(day)) continue;
        blocked = day;
        break;
      }
      const seen = new Set();
      const chosen = [];
      for (const cell of cells) {
        const shift = (shiftsBySite.get(siteId) ?? []).find((item) => item.id === cell.shiftId);
        if (!shift) continue;
        if (worker.band !== null && shift.band !== worker.band && !assigned.has(`${cell.weekday}|${cell.shiftId}`)) continue;
        if (cell.weekday === blocked && !assigned.has(`${cell.weekday}|${cell.shiftId}`)) continue;
        const date = addDays(week, cell.weekday);
        if (absent(worker.id, date) && !assigned.has(`${cell.weekday}|${cell.shiftId}`)) continue;
        const key = `${cell.weekday}|${cell.shiftId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        chosen.push(cell);
      }
      for (const key of assigned) {
        if (seen.has(key)) continue;
        const [weekday, shiftId] = key.split("|");
        chosen.push({ weekday: Number(weekday), shiftId });
      }
      availabilityWeeks.push({
        id: weekId,
        org_id: ORG,
        site_id: siteId,
        employee_id: worker.id,
        week_start: week,
      });
      for (const cell of chosen) {
        availabilityEntries.push({
          org_id: ORG,
          availability_week_id: weekId,
          shift_id: cell.shiftId,
          weekday: cell.weekday,
        });
      }
    }
  }
  if (weekIndex % 4 === 0) {
    for (const site of sites) {
      const worker = workers.filter((item) => item.home === site.id)[weekIndex % 5];
      if (!worker) continue;
      const when = atLocal(addDays(week, 1), 16 * 60);
      if (when > NOW.toISOString()) continue;
      notes.push({
        id: randomUUID(),
        org_id: ORG,
        site_id: site.id,
        week_start: week,
        raw: CONSTRAINT_NOTES[weekIndex % CONSTRAINT_NOTES.length],
        employee_ids: [worker.id],
        model_lines: [],
        approved_at: when,
      });
      grants.push({
        org_id: ORG,
        site_id: site.id,
        employee_id: worker.id,
        week_start: week,
      });
    }
  }
}

const currentWeek = sundayOnOrBefore(TODAY);
const pendingPeople = workers.filter((worker) => worker.sites.includes(sites[0]?.id)).slice(0, 3);
for (const worker of pendingPeople) {
  const siteId = worker.home;
  const cells = agreements.get(`${worker.id}|${siteId}`) ?? [];
  const grid = [[], [], [], [], [], [], []];
  for (const cell of cells) {
    if (worker.band !== null) {
      const shift = (shiftsBySite.get(siteId) ?? []).find((item) => item.id === cell.shiftId);
      if (shift && shift.band !== worker.band) continue;
    }
    if (cell.weekday === 1) continue;
    grid[cell.weekday].push(cell.shiftId);
  }
  requests.push({
    id: randomUUID(),
    org_id: ORG,
    site_id: siteId,
    employee_id: worker.id,
    week_start: currentWeek,
    status: "pending",
    shifts: grid,
    created_at: atLocal(addDays(TODAY, -1), 18 * 60),
    decided_at: null,
  });
}

const sickFiles = [];
const forms = [];
for (const absence of absences) {
  if (absence.kind !== "sick" || absence.status !== "approved") continue;
  const person = workerById.get(absence.employee_id);
  const body = Buffer.from(
    `אישור מחלה\n${person?.name ?? ""}\n${absence.start_date} עד ${absence.end_date}\n${absence.note}\nאינו כשיר לעבודה בימים אלה.\n`,
    "utf8",
  );
  sickFiles.push({
    id: randomUUID(),
    org_id: ORG,
    site_id: absence.site_id,
    request_id: absence.id,
    employee_id: absence.employee_id,
    file_name: `אישור-מחלה-${absence.start_date}.txt`,
    content_type: "text/plain",
    byte_size: body.length,
    body,
    created_at: absence.decided_at,
  });
  forms.push({
    id: randomUUID(),
    org_id: ORG,
    employee_id: absence.employee_id,
    file_name: `אישור-מחלה-${absence.start_date}.txt`,
    content_type: "text/plain",
    byte_size: body.length,
    body,
    created_at: absence.decided_at,
  });
}

function rowsOf(items, columns) {
  return items.map((item) => Object.fromEntries(columns.map((column) => [column, item[column]])));
}

async function insertChunks(tx, table, items, columns, size = 300) {
  const prepared = rowsOf(items, columns);
  for (let index = 0; index < prepared.length; index += size) {
    const slice = prepared.slice(index, index + size);
    const values = tx(slice, ...columns);
    if (table === "public.schedules") await tx`insert into public.schedules ${values}`;
    else if (table === "public.assignments") await tx`insert into public.assignments ${values}`;
    else if (table === "public.assignment_extensions") await tx`insert into public.assignment_extensions ${values}`;
    else if (table === "public.schedule_calloffs") await tx`insert into public.schedule_calloffs ${values}`;
    else if (table === "public.absence_requests") await tx`insert into public.absence_requests ${values}`;
    else if (table === "public.shift_trades") await tx`insert into public.shift_trades ${values}`;
    else if (table === "public.availability_weeks") await tx`insert into public.availability_weeks ${values}`;
    else if (table === "public.availability_entries") await tx`insert into public.availability_entries ${values}`;
    else if (table === "public.constraint_grants") await tx`insert into public.constraint_grants ${values}`;
    else if (table === "public.attendance_punches") await tx`insert into public.attendance_punches ${values}`;
    else if (table === "public.schedule_staffing") await tx`insert into public.schedule_staffing ${values}`;
    else throw new Error(table);
  }
}

await sql.begin(async (tx) => {
  await tx`delete from public.attendance_punches where org_id = ${ORG}`;
  await tx`delete from public.absence_requests where org_id = ${ORG}`;
  await tx`delete from public.employee_documents where org_id = ${ORG}`;
  await tx`delete from public.shift_trades where org_id = ${ORG}`;
  await tx`delete from public.availability_requests where org_id = ${ORG}`;
  await tx`delete from public.availability_weeks where org_id = ${ORG}`;
  await tx`delete from public.constraint_notes where org_id = ${ORG}`;
  await tx`delete from public.constraint_grants where org_id = ${ORG}`;
  await tx`delete from public.schedules where org_id = ${ORG}`;

  await insertChunks(tx, "public.schedules", schedules, ["id", "org_id", "site_id", "week_start", "status"]);
  await insertChunks(tx, "public.assignments", assignments, ["org_id", "schedule_id", "shift_id", "weekday", "employee_id", "locked", "over_quota"]);
  await insertChunks(tx, "public.assignment_extensions", extensions, [
    "org_id",
    "schedule_id",
    "shift_id",
    "weekday",
    "employee_id",
    "start_hour",
    "end_hour",
    "group_id",
    "cover_shift_id",
    "cover_weekday",
    "group_size",
  ]);
  await insertChunks(tx, "public.schedule_calloffs", calloffs, [
    "id",
    "org_id",
    "schedule_id",
    "shift_id",
    "weekday",
    "employee_id",
    "reported_at",
    "reported_by_name",
  ]);
  for (const version of versions) {
    await tx`
      insert into public.schedule_versions (id, org_id, schedule_id, number, reason, restored_from, author_name, snapshot, created_at)
      values (
        ${version.id}, ${version.org_id}, ${version.schedule_id}, ${version.number}, ${version.reason},
        ${version.restored_from}, ${version.author_name}, ${tx.json(version.snapshot)}, ${version.created_at}
      )
    `;
  }
  await insertChunks(tx, "public.absence_requests", absences, [
    "id",
    "org_id",
    "site_id",
    "employee_id",
    "kind",
    "start_date",
    "end_date",
    "note",
    "status",
    "created_at",
    "decided_at",
  ]);
  for (const file of sickFiles) {
    await tx`
      insert into public.absence_documents (
        id, org_id, site_id, request_id, employee_id, file_name, content_type, byte_size, body, created_at
      ) values (
        ${file.id}, ${file.org_id}, ${file.site_id}, ${file.request_id}, ${file.employee_id},
        ${file.file_name}, ${file.content_type}, ${file.byte_size}, ${file.body}, ${file.created_at}
      )
    `;
  }
  for (const file of forms) {
    await tx`
      insert into public.employee_documents (
        id, org_id, employee_id, file_name, content_type, byte_size, body, created_at
      ) values (
        ${file.id}, ${file.org_id}, ${file.employee_id}, ${file.file_name}, ${file.content_type},
        ${file.byte_size}, ${file.body}, ${file.created_at}
      )
    `;
  }
  await insertChunks(tx, "public.shift_trades", trades, [
    "id",
    "org_id",
    "site_id",
    "week_start",
    "kind",
    "requester_id",
    "offered_shift_id",
    "offered_weekday",
    "target_id",
    "target_shift_id",
    "target_weekday",
    "status",
    "created_at",
    "answered_at",
    "decided_at",
  ]);
  await insertChunks(tx, "public.availability_weeks", availabilityWeeks, ["id", "org_id", "site_id", "employee_id", "week_start"]);
  await insertChunks(tx, "public.availability_entries", availabilityEntries, ["org_id", "availability_week_id", "shift_id", "weekday"]);
  for (const request of requests) {
    await tx`
      insert into public.availability_requests (id, org_id, site_id, employee_id, week_start, status, shifts, created_at, decided_at)
      values (
        ${request.id}, ${request.org_id}, ${request.site_id}, ${request.employee_id}, ${request.week_start},
        ${request.status}, ${tx.json(request.shifts)}, ${request.created_at}, ${request.decided_at}
      )
    `;
  }
  for (const note of notes) {
    await tx`
      insert into public.constraint_notes (id, org_id, site_id, week_start, raw, employee_ids, model_lines, approved_at)
      values (
        ${note.id}, ${note.org_id}, ${note.site_id}, ${note.week_start}, ${note.raw},
        ${note.employee_ids}, ${note.model_lines}, ${note.approved_at}
      )
    `;
  }
  await insertChunks(tx, "public.constraint_grants", grants, ["org_id", "site_id", "employee_id", "week_start"]);
  await insertChunks(tx, "public.attendance_punches", punches, [
    "id",
    "org_id",
    "site_id",
    "employee_id",
    "kind",
    "punched_at",
    "device_at",
    "device_offset_minutes",
    "latitude",
    "longitude",
    "accuracy_meters",
  ]);
  await insertChunks(tx, "public.schedule_staffing", staffing, ["org_id", "schedule_id", "shift_id", "weekday", "required_count"]);

  await tx`
    delete from public.assignments a
    using public.schedules s
    where a.schedule_id = s.id and s.org_id = ${ORG} and (s.week_start + a.weekday) > current_date
  `;
  await tx`delete from public.schedules where org_id = ${ORG} and week_start > current_date`;
  await tx`delete from public.absence_requests where org_id = ${ORG} and start_date > current_date`;
  await tx`update public.absence_requests set end_date = current_date where org_id = ${ORG} and end_date > current_date`;
  await tx`delete from public.attendance_punches where org_id = ${ORG} and punched_at > now()`;
  await tx`delete from public.availability_weeks where org_id = ${ORG} and week_start > current_date`;
});

const summary = await sql`
  select
    ${TODAY} as today,
    ${WINDOW_START} as window_start,
    (select count(*) from public.schedules where org_id = ${ORG}) as weeks,
    (select count(*) from public.assignments a join public.schedules s on s.id = a.schedule_id where s.org_id = ${ORG}) as assignments,
    (select count(*) from public.schedule_calloffs where org_id = ${ORG}) as calloffs,
    (select count(*) from public.schedule_versions where org_id = ${ORG}) as versions,
    (select count(*) from public.shift_trades where org_id = ${ORG}) as trades,
    (select count(*) from public.absence_requests where org_id = ${ORG} and kind = 'sick' and status = 'approved') as sick,
    (select count(*) from public.absence_requests where org_id = ${ORG} and kind = 'vacation' and status = 'approved') as vacation,
    (select count(*) from public.availability_weeks where org_id = ${ORG}) as constraint_weeks,
    (select count(*) from public.constraint_notes where org_id = ${ORG}) as notes,
    (select count(*) from public.attendance_punches where org_id = ${ORG}) as punches,
    (select count(*) from public.assignment_extensions where org_id = ${ORG}) as hour_changes,
    (select count(*) from public.assignments a join public.schedules s on s.id = a.schedule_id where s.org_id = ${ORG} and (s.week_start + a.weekday) > current_date) as future_assignments,
    (select count(*) from public.attendance_punches where org_id = ${ORG} and punched_at > now()) as future_punches,
    (select count(*) from public.absence_requests where org_id = ${ORG} and end_date > current_date) as future_absences
`;
console.log(JSON.stringify(summary[0], null, 2));
await sql.end();

import postgres from "postgres";

const ORG = "a1111111-1111-4111-8111-111111111111";
const OWNER = id(401);
const SITE_N = id(101);
const SITE_S = id(102);

const MGR_CAPS = {
  clock: true,
  trades: false,
  absences: true,
  insights: true,
  messages: true,
  documents: true,
  constraints: false,
  people_edit: true,
  people_site: true,
  schedule_edit: true,
  schedule_view: true,
  site_settings: true,
};
const WORKER_CAPS = {
  clock: true,
  trades: true,
  absences: true,
  insights: false,
  messages: false,
  documents: false,
  constraints: true,
  people_edit: false,
  people_site: false,
  schedule_edit: false,
  schedule_view: true,
  site_settings: false,
};

function id(n) {
  return `a1111111-1111-4111-8111-111111111${String(n).padStart(3, "0")}`;
}

function nationalId(n) {
  const digits = String(32000000 + n * 13).padStart(8, "0").slice(-8);
  let sum = 0;
  for (let i = 0; i < 8; i += 1) {
    let v = Number(digits[i]) * (i % 2 === 0 ? 1 : 2);
    if (v > 9) v -= 9;
    sum += v;
  }
  return digits + String((10 - (sum % 10)) % 10);
}

function profile(person, index) {
  const north = person.home === SITE_N;
  const male = person.gender === "male";
  const streets = north
    ? ["הרצל", "מוריה", "הנשיא", "אלנבי", "הגפן"]
    : ["רגר", "העצמאות", "יצחק רגר", "התקווה", "שדרות רגר"];
  const cities = north ? ["חיפה", "קריית אתא", "נשר"] : ["באר שבע", "אופקים", "נתיבות"];
  const banks = ["בנק לאומי", "בנק הפועלים", "בנק דיסקונט"];
  return {
    nationalId: nationalId(index + 17),
    birthDate: `${1984 + (index % 18)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 27) + 1).padStart(2, "0")}`,
    gender: person.gender,
    mobile: person.phone,
    city: cities[index % cities.length],
    street: streets[index % streets.length],
    houseNumber: String(8 + (index % 40)),
    zip: north ? String(3100000 + index) : String(8400000 + index),
    startedOn: index % 5 === 0 ? "2023-03-01" : index % 5 === 1 ? "2024-01-15" : "2025-04-01",
    endedOn: "",
    employeeNumber: `D-${String(1001 + index).padStart(4, "0")}`,
    department: person.role === "מנהל אתר" ? "ניהול" : person.role,
    maritalStatus: ["married", "single", "married", "divorced"][index % 4],
    bankName: banks[index % banks.length],
    bankBranch: String(100 + (index % 80)),
    bankAccount: String(1200000 + index * 17),
  };
}

const managers = [
  { id: id(402), name: "אורלי בן-דוד", email: "manager1@rota.com", phone: "050-7110001", gender: "female", home: SITE_N, role: "מנהל אתר" },
  { id: id(404), name: "מיכאל חדד", email: "michael.haddad@demo.rota.local", phone: "050-7110002", gender: "male", home: SITE_N, role: "מנהל אתר" },
  { id: id(403), name: "קרן אביב", email: "manager2@rota.com", phone: "050-7220001", gender: "female", home: SITE_S, role: "מנהל אתר" },
  { id: id(405), name: "יואב נחום", email: "yoav.nahum@demo.rota.local", phone: "050-7220002", gender: "male", home: SITE_S, role: "מנהל אתר" },
];

const northWorkers = [
  ["יוסי כהן", "male", "חמוש", "yossi.cohen"],
  ["דני לוי", "male", "חמוש", "danny.levy"],
  ["איתי מזרחי", "male", "חמוש", "itay.mizrahi"],
  ["רועי אזולאי", "male", "חמוש", "roei.azulay"],
  ["נועם ברק", "male", "חמוש", "noam.barak"],
  ["אביחי פרץ", "male", "חמוש", "avihai.peretz"],
  ["מתן שמעוני", "male", "חמוש", "matan.shimaoni"],
  ["ליאור חדד", "male", "חמוש", "lior.haddad"],
  ["עומר ביטון", "male", "חמוש", "omer.biton"],
  ["מיה גולן", "female", "סיור", "maya.golan"],
  ["נועה שמש", "female", "סיור", "noa.shemesh"],
  ["תמר אברהם", "female", "סיור", "tamar.avraham"],
  ["שירה נחום", "female", "סיור", "shira.nahum"],
  ["הדר מלכה", "female", "סיור", "hadar.malka"],
  ["יעל דהן", "female", "סיור", "yael.dahan"],
  ["רותם קליין", "female", "סיור", "rotem.klein"],
  ["עדן לוי", "female", "סיור", "eden.levy"],
  ["קרן פרי", "female", "סיור", "keren.peri"],
  ["אלון רז", "male", "אחמש", "alon.raz"],
  ["גיא סלע", "male", "אחמש", "guy.sela"],
  ["נדב אילן", "male", "אחמש", "nadav.ilan"],
  ["אסף חיים", "male", "אחמש", "assaf.haim"],
  ["עידו בר", "male", "אחמש", "ido.bar"],
].map(([name, gender, role, latin], i) => ({
  id: id(411 + i),
  name,
  gender,
  role,
  home: SITE_N,
  phone: `050-731${String(1000 + i).slice(-4)}`,
  email: i < 8 ? `worker${i + 1}@rota.com` : `${latin}@demo.rota.local`,
  relief: [0, 1, 9, 18].includes(i),
}));

const southWorkers = [
  ["אורי נחמני", "male", "חמוש", "uri.nahmias"],
  ["בן שושן", "male", "חמוש", "ben.shoshan"],
  ["תומר עמר", "male", "חמוש", "tomer.amar"],
  ["יובל כץ", "male", "חמוש", "yuval.katz"],
  ["איתן אוחיון", "male", "חמוש", "eitan.ohayon"],
  ["שי משה", "male", "חמוש", "shai.moshe"],
  ["רון אלבז", "male", "חמוש", "ron.elbaz"],
  ["ניר גבאי", "male", "חמוש", "nir.gabay"],
  ["פלג אדרי", "male", "חמוש", "peleg.edri"],
  ["דנה רוזן", "female", "סיור", "dana.rozen"],
  ["מאיה שטרן", "female", "סיור", "maya.stern"],
  ["ליאת כץ", "female", "סיור", "liat.katz"],
  ["הילה בר", "female", "סיור", "hila.bar"],
  ["ספיר לוי", "female", "סיור", "sapir.levy"],
  ["נטע כהן", "female", "סיור", "neta.cohen"],
  ["עדי מור", "female", "סיור", "adi.mor"],
  ["טל אשכנזי", "female", "סיור", "tal.ashkenazi"],
  ["מורן גל", "female", "סיור", "moran.gal"],
  ["אמיר פלד", "male", "אחמש", "amir.peled"],
  ["קובי ישראלי", "male", "אחמש", "kobi.israeli"],
  ["רן אהרוני", "male", "אחמש", "ran.aharoni"],
  ["יובל דרור", "male", "אחמש", "yuval.dror"],
  ["שי לוין", "male", "אחמש", "shai.levin"],
].map(([name, gender, role, latin], i) => ({
  id: id(441 + i),
  name,
  gender,
  role,
  home: SITE_S,
  phone: `050-741${String(1000 + i).slice(-4)}`,
  email: `${latin}@demo.rota.local`,
  relief: [0, 1, 9, 18].includes(i),
}));

const people = [...managers, ...northWorkers, ...southWorkers];
const keepIds = [OWNER, ...people.map((p) => p.id)];

const bands = [
  { key: "morning", label: "בוקר", n: ["07:00:00", "15:00:00"], s: ["06:00:00", "14:00:00"] },
  { key: "afternoon", label: "צהריים", n: ["15:00:00", "23:00:00"], s: ["14:00:00", "22:00:00"] },
  { key: "night", label: "לילה", n: ["23:00:00", "07:00:00"], s: ["22:00:00", "06:00:00"] },
];
const roles = [
  { role: "חמוש", count: 2 },
  { role: "סיור", count: 2 },
  { role: "אחמש", count: 1 },
];

function shiftRows(siteId, times) {
  const rows = [];
  let position = 0;
  let n = siteId === SITE_N ? 210 : 220;
  for (const band of bands) {
    for (const role of roles) {
      rows.push({
        id: id(n),
        org_id: ORG,
        site_id: siteId,
        name: `${band.label} · ${role.role}`,
        starts_at: times[0],
        ends_at: times[1],
        required_role: role.role,
        position,
        count: role.count,
      });
      n += 1;
      position += 1;
    }
  }
  return rows;
}

const shifts = [...shiftRows(SITE_N, bands[0].n), ...shiftRows(SITE_S, bands[0].s)].map((row, i) => {
  const band = bands[Math.floor((i % 9) / 3)];
  const times = row.site_id === SITE_N ? band.n : band.s;
  return { ...row, starts_at: times[0], ends_at: times[1] };
});

const url = process.env.SUPABASE_DB_URL;
if (!url) throw new Error("SUPABASE_DB_URL missing");
const sql = postgres(url, { prepare: false, ssl: "require", max: 1, connect_timeout: 20 });

await sql.begin(async (tx) => {
  await tx`update public.sites set name = ${"אתר צפון"} where id = ${SITE_N} and org_id = ${ORG}`;
  await tx`update public.sites set name = ${"אתר דרום"} where id = ${SITE_S} and org_id = ${ORG}`;

  await tx`delete from public.assignment_extensions where org_id = ${ORG}`;
  await tx`delete from public.assignments where org_id = ${ORG}`;
  await tx`delete from public.schedule_calloffs where org_id = ${ORG}`;
  await tx`delete from public.schedule_staffing where org_id = ${ORG}`;
  await tx`delete from public.availability_entries where org_id = ${ORG}`;
  await tx`delete from public.availability_weeks where org_id = ${ORG}`;
  await tx`delete from public.employee_agreements where org_id = ${ORG}`;
  await tx`delete from public.employee_preferences where org_id = ${ORG}`;
  await tx`delete from public.shift_requirements where org_id = ${ORG}`;
  await tx`delete from public.shifts where org_id = ${ORG}`;

  await tx`insert into public.shifts ${tx(
    shifts.map(({ count, ...row }) => row),
  )}`;
  const reqs = [];
  for (const shift of shifts) {
    for (let weekday = 0; weekday < 7; weekday += 1) {
      reqs.push({
        org_id: ORG,
        shift_id: shift.id,
        weekday,
        required_count: shift.count,
      });
    }
  }
  await tx`insert into public.shift_requirements ${tx(reqs)}`;

  await tx`
    insert into public.qualifications (id, org_id, name)
    values
      (${id(504)}, ${ORG}, ${"חמוש"}),
      (${id(505)}, ${ORG}, ${"סיור"}),
      (${id(506)}, ${ORG}, ${"אחמש"})
    on conflict (org_id, name) do nothing
  `;

  await tx`
    update public.employees
    set
      name = ${"דוד רוט"},
      email = ${"owner@rota.com"},
      job_title = ${"בעלים"},
      phone = ${"050-7000001"},
      schedulable = false,
      weekly_shift_quota = 0,
      home_site_id = null,
      reports_to = null,
      profile = ${tx.json({
        nationalId: nationalId(1),
        birthDate: "1978-06-12",
        gender: "male",
        mobile: "050-7000001",
        city: "תל אביב-יפו",
        street: "רוטשילד",
        houseNumber: "12",
        zip: "6688101",
        startedOn: "2022-01-01",
        endedOn: "",
        employeeNumber: "D-1000",
        department: "הנהלה",
        maritalStatus: "married",
        bankName: "בנק לאומי",
        bankBranch: "801",
        bankAccount: "1200001",
      })}
    where id = ${OWNER} and org_id = ${ORG}
  `;

  for (const [index, person] of people.entries()) {
    const schedulable = person.role !== "מנהל אתר";
    const reportsTo = schedulable
      ? person.home === SITE_N
        ? id(402)
        : id(403)
      : OWNER;
    const wage = person.role === "אחמש" ? 52 : person.role === "חמוש" ? 46 : person.role === "סיור" ? 42 : 0;
    const row = {
      id: person.id,
      org_id: ORG,
      name: person.name,
      email: person.email,
      job_title: person.role,
      weekly_shift_quota: schedulable ? 5 : 0,
      max_weekly_hours: schedulable ? 48 : null,
      active: true,
      hourly_wage: wage,
      phone: person.phone,
      home_site_id: person.home,
      observes_shabbat: false,
      observes_holidays: false,
      reports_to: reportsTo,
      opened_by: OWNER,
      capabilities: tx.json(schedulable ? WORKER_CAPS : MGR_CAPS),
      schedulable,
      profile: tx.json(profile(person, index + 2)),
    };
    await tx`
      insert into public.employees ${tx(row)}
      on conflict (id) do update set
        name = excluded.name,
        email = excluded.email,
        job_title = excluded.job_title,
        weekly_shift_quota = excluded.weekly_shift_quota,
        max_weekly_hours = excluded.max_weekly_hours,
        active = true,
        hourly_wage = excluded.hourly_wage,
        phone = excluded.phone,
        home_site_id = excluded.home_site_id,
        reports_to = excluded.reports_to,
        opened_by = excluded.opened_by,
        capabilities = excluded.capabilities,
        schedulable = excluded.schedulable,
        profile = excluded.profile
    `;
  }

  await tx`delete from public.employees where org_id = ${ORG} and not (id = any(${keepIds}))`;

  await tx`delete from public.employee_sites where org_id = ${ORG}`;
  await tx`delete from public.employee_managed_sites where org_id = ${ORG}`;
  await tx`delete from public.employee_qualifications where org_id = ${ORG}`;
  await tx`delete from public.site_memberships where org_id = ${ORG}`;

  const siteRows = [];
  const managedRows = [];
  const qualRows = [];
  const agreementRows = [];
  const membershipRows = [];

  const qualByName = Object.fromEntries(
    (await tx`select id, name from public.qualifications where org_id = ${ORG}`).map((q) => [q.name, q.id]),
  );

  function roleShifts(siteId, role) {
    return shifts.filter((s) => s.site_id === siteId && s.required_role === role).map((s) => s.id);
  }

  for (const person of managers) {
    managedRows.push({ org_id: ORG, employee_id: person.id, site_id: person.home });
  }

  for (const person of [...northWorkers, ...southWorkers]) {
    siteRows.push({ org_id: ORG, employee_id: person.id, site_id: person.home });
    if (person.relief) {
      siteRows.push({
        org_id: ORG,
        employee_id: person.id,
        site_id: person.home === SITE_N ? SITE_S : SITE_N,
      });
    }
    const quals = [person.role];
    if (person.role === "אחמש" || person.role === "סיור") quals.push("עזרה ראשונה");
    if (person.role === "חמוש" && person.id.endsWith("1")) quals.push("נהג");
    for (const name of quals) {
      if (qualByName[name]) {
        qualRows.push({ org_id: ORG, employee_id: person.id, qualification_id: qualByName[name] });
      }
    }
    const sites = [person.home];
    if (person.relief) sites.push(person.home === SITE_N ? SITE_S : SITE_N);
    for (const siteId of sites) {
      for (const shiftId of roleShifts(siteId, person.role)) {
        for (let weekday = 0; weekday < 7; weekday += 1) {
          agreementRows.push({
            org_id: ORG,
            employee_id: person.id,
            shift_id: shiftId,
            weekday,
          });
        }
      }
    }
  }

  const withLogin = await tx`
    select id, user_id, job_title, home_site_id
    from public.employees
    where org_id = ${ORG} and user_id is not null
  `;
  for (const row of withLogin) {
    if (row.id === OWNER) continue;
    const role = row.job_title === "מנהל אתר" ? "manager" : "employee";
    membershipRows.push({
      org_id: ORG,
      site_id: row.home_site_id,
      user_id: row.user_id,
      role,
    });
    const person = people.find((p) => p.id === row.id);
    if (person?.relief) {
      membershipRows.push({
        org_id: ORG,
        site_id: person.home === SITE_N ? SITE_S : SITE_N,
        user_id: row.user_id,
        role: "employee",
      });
    }
  }

  if (siteRows.length) await tx`insert into public.employee_sites ${tx(siteRows)}`;
  if (managedRows.length) await tx`insert into public.employee_managed_sites ${tx(managedRows)}`;
  if (qualRows.length) await tx`insert into public.employee_qualifications ${tx(qualRows)} on conflict do nothing`;
  if (agreementRows.length) await tx`insert into public.employee_agreements ${tx(agreementRows)}`;
  if (membershipRows.length) await tx`insert into public.site_memberships ${tx(membershipRows)} on conflict do nothing`;
});

const summary = await sql`
  select
    e.name,
    e.email,
    e.phone,
    e.job_title,
    s.name as home,
    e.schedulable,
    e.profile->>'nationalId' as nid,
    exists(
      select 1 from public.employee_sites es
      where es.employee_id = e.id and es.site_id <> e.home_site_id
    ) as relief
  from public.employees e
  left join public.sites s on s.id = e.home_site_id
  where e.org_id = ${ORG}
  order by e.schedulable, s.name, e.job_title, e.name
`;
const counts = await sql`
  select
    (select count(*) from public.sites where org_id = ${ORG}) as sites,
    (select count(*) from public.shifts where org_id = ${ORG}) as shifts,
    (select count(*) from public.employees where org_id = ${ORG} and schedulable) as workers,
    (select count(*) from public.employees where org_id = ${ORG} and not schedulable) as unsched,
    (select count(*) from public.employee_sites es join public.employees e on e.id = es.employee_id
      where es.org_id = ${ORG} and es.site_id <> e.home_site_id) as relief
`;
console.log(JSON.stringify({ counts: counts[0], people: summary }, null, 2));
await sql.end();

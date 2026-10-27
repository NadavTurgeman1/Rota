import { toRotaState } from "./map";
import type {
  AgreementRow,
  AssignmentRow,
  AvailabilityEntryRow,
  AvailabilityWeekRow,
  CallOffRow,
  EmployeeRow,
  ExtensionRow,
  ConstraintGrantRow,
  NoteRow,
  PreferenceRow,
  QualificationRow,
  RequirementRow,
  ScheduleRow,
  ShiftRow,
  SiteBundle,
  SiteRow,
  SqlClient,
  VersionRow,
} from "./types";
import type { RotaState } from "../domain/types";

/** Load one site, including other weeks so rest can cross the Sunday boundary. */
export async function loadSiteWeek(sql: SqlClient, siteId: string, week: string): Promise<RotaState> {
  const sites = await sql.query<SiteRow>(
    `select
       s.id,
       s.name,
       s.timezone,
       s.min_rest_hours::float8 as min_rest_hours,
       s.max_weekly_hours::float8 as max_weekly_hours,
       s.max_shift_hours::float8 as max_shift_hours,
       s.max_day_hours::float8 as max_day_hours,
       s.assume_available,
       s.staff_access,
       s.constraint_opens_day::int as constraint_opens_day,
       s.constraint_closes_day::int as constraint_closes_day,
       to_char(s.constraint_opens, 'HH24:MI') as constraint_opens,
       to_char(s.constraint_closes, 'HH24:MI') as constraint_closes,
       s.constraint_block_limit,
       s.constraint_max_blocks::int as constraint_max_blocks,
       to_json(s.constraint_extension_until) #>> '{}' as constraint_extension_until,
       o.name as org_name,
       o.kind as org_kind
     from public.sites s
     join public.organizations o on o.id = s.org_id
     where s.id = $1`,
    [siteId],
  );
  const site = sites[0];
  if (!site) throw new Error(`Unknown site: ${siteId}`);

  const [
    shifts,
    requirements,
    employees,
    historical,
    qualifications,
    preferences,
    agreements,
    availabilityWeeks,
    availabilityEntries,
    schedules,
    assignments,
    extensions,
    calloffs,
    versions,
    notes,
    grants,
  ] =
    await Promise.all([
      sql.query<ShiftRow>(
        `select id, name, to_char(starts_at, 'HH24:MI') as starts_at, to_char(ends_at, 'HH24:MI') as ends_at,
                required_role, position
         from public.shifts
         where site_id = $1
         order by position, name`,
        [siteId],
      ),
      sql.query<RequirementRow>(
        `select r.shift_id, r.weekday::int as weekday, r.required_count
         from public.shift_requirements r
         join public.shifts s on s.id = r.shift_id
         where s.site_id = $1`,
        [siteId],
      ),
      sql.query<EmployeeRow>(
        `select e.id, e.name, e.email, e.phone, e.home_site_id, e.job_title, e.weekly_shift_quota,
                e.max_weekly_hours::float8 as max_weekly_hours, e.active,
                e.hourly_wage::float8 as hourly_wage,
                coalesce(p.email, open_invite.email, '') as login_email,
                (e.user_id is not null) as login_confirmed,
                true as on_roster,
                ep.profile as profile
         from public.employees e
         join public.employee_sites es on es.employee_id = e.id
         left join public.employee_profiles ep on ep.employee_id = e.id
         left join public.profiles p on p.user_id = e.user_id
         left join lateral (
           select i.email
           from public.invitations i
           where i.kind = 'staff' and i.employee_id = e.id and i.consumed_at is null
           limit 1
         ) open_invite on true
         where es.site_id = $1
         order by e.name`,
        [siteId],
      ),
      sql.query<EmployeeRow>(
        `select e.id, e.name, e.email, e.phone, e.home_site_id, e.job_title, e.weekly_shift_quota,
                e.max_weekly_hours::float8 as max_weekly_hours, e.active,
                e.hourly_wage::float8 as hourly_wage,
                '' as login_email,
                false as login_confirmed,
                false as on_roster,
                ep.profile as profile
         from public.employees e
         left join public.employee_profiles ep on ep.employee_id = e.id
         where e.id in (
           select a.employee_id
           from public.assignments a
           join public.schedules sc on sc.id = a.schedule_id
           where sc.site_id = $1
           union
           select c.employee_id
           from public.schedule_calloffs c
           join public.schedules sc on sc.id = c.schedule_id
           where sc.site_id = $1
         )
           and not exists (
             select 1 from public.employee_sites es
             where es.employee_id = e.id and es.site_id = $1
           )`,
        [siteId],
      ),
      sql.query<QualificationRow>(
        `select eq.employee_id, q.name
         from public.employee_qualifications eq
         join public.qualifications q on q.id = eq.qualification_id
         join public.employee_sites es on es.employee_id = eq.employee_id
         where es.site_id = $1`,
        [siteId],
      ),
      sql.query<PreferenceRow>(
        `select p.employee_id, p.shift_id
         from public.employee_preferences p
         join public.shifts s on s.id = p.shift_id
         where s.site_id = $1`,
        [siteId],
      ),
      sql.query<AgreementRow>(
        `select a.employee_id, a.shift_id, a.weekday::int as weekday
         from public.employee_agreements a
         join public.shifts s on s.id = a.shift_id
         where s.site_id = $1`,
        [siteId],
      ),
      sql.query<AvailabilityWeekRow>(
        `select id, employee_id, week_start::text as week_start
         from public.availability_weeks
         where site_id = $1`,
        [siteId],
      ),
      sql.query<AvailabilityEntryRow>(
        `select e.availability_week_id, e.shift_id, e.weekday::int as weekday
         from public.availability_entries e
         join public.availability_weeks w on w.id = e.availability_week_id
         where w.site_id = $1`,
        [siteId],
      ),
      sql.query<ScheduleRow>(
        `select id, week_start::text as week_start, status, restored_from
         from public.schedules
         where site_id = $1`,
        [siteId],
      ),
      sql.query<AssignmentRow>(
        `select a.schedule_id, a.shift_id, a.weekday::int as weekday, a.employee_id, a.locked, a.over_quota
         from public.assignments a
         join public.schedules sc on sc.id = a.schedule_id
         where sc.site_id = $1
         order by a.employee_id`,
        [siteId],
      ),
      sql.query<ExtensionRow>(
        `select x.schedule_id, x.shift_id, x.weekday::int as weekday, x.employee_id,
                x.start_hour::float8 as start_hour, x.end_hour::float8 as end_hour,
                x.group_id, x.cover_shift_id, x.cover_weekday::int as cover_weekday, x.group_size
         from public.assignment_extensions x
         join public.schedules sc on sc.id = x.schedule_id
         where sc.site_id = $1`,
        [siteId],
      ),
      sql.query<CallOffRow>(
        `select c.id, c.schedule_id, c.shift_id, c.weekday::int as weekday, c.employee_id,
                e.name as employee_name, to_json(c.reported_at) #>> '{}' as reported_at,
                c.reported_by, c.reported_by_name
         from public.schedule_calloffs c
         join public.schedules sc on sc.id = c.schedule_id
         join public.employees e on e.id = c.employee_id
         where sc.site_id = $1
         order by c.reported_at, c.id`,
        [siteId],
      ),
      sql.query<VersionRow>(
        `select v.id, v.schedule_id, v.number, v.reason, v.restored_from,
                to_json(v.created_at) #>> '{}' as created_at, v.created_by, v.author_name, v.snapshot
         from public.schedule_versions v
         join public.schedules sc on sc.id = v.schedule_id
         where sc.site_id = $1
         order by v.number`,
        [siteId],
      ),
      sql.query<NoteRow>(
        `select id, week_start::text as week_start, raw, employee_ids::text[] as employee_ids, model_lines,
                to_json(approved_at) #>> '{}' as approved_at
         from public.constraint_notes
         where site_id = $1
         order by approved_at, id`,
        [siteId],
      ),
      sql.query<ConstraintGrantRow>(
        `select employee_id, week_start::text as week_start
         from public.constraint_grants
         where site_id = $1
         order by week_start, employee_id`,
        [siteId],
      ),
    ]);

  const bundle: SiteBundle = {
    site,
    shifts,
    requirements,
    employees: [...employees, ...historical],
    qualifications,
    preferences,
    agreements,
    availabilityWeeks,
    availabilityEntries,
    schedules: schedules.map((schedule) => ({
      ...schedule,
      status: schedule.status === "published" ? "published" : "draft",
    })),
    assignments,
    extensions,
    calloffs,
    versions,
    notes,
    grants,
  };
  return toRotaState(bundle, week);
}

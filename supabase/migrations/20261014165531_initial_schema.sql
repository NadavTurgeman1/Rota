-- Tenant boundary is the organization. Every other table carries org_id so
-- membership checks stay indexed, and composite foreign keys keep that id
-- aligned with the parent row.
--
-- authenticated members of an org can read and write that org.
-- Role splits (owner / manager / employee) are Phase 3.
-- Creating the first organization is a privileged operation until then,
-- because a non-member cannot satisfy the membership policy.
--
-- Requires the Supabase roles anon and authenticated, and auth.uid().

create schema if not exists private;

revoke all on schema private from public;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text not null default '',
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'employee')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_id_idx on public.memberships (user_id);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Jerusalem',
  min_rest_hours numeric(4, 2) not null default 11 check (min_rest_hours >= 0),
  max_weekly_hours numeric(5, 2) not null default 48 check (max_weekly_hours > 0),
  max_shift_hours numeric(4, 2) not null default 12 check (max_shift_hours > 0),
  assume_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create index sites_org_id_idx on public.sites (org_id);

create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  unique (id, org_id),
  unique (org_id, name)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  contact text not null default '',
  job_title text not null default '',
  weekly_shift_quota integer not null default 0 check (weekly_shift_quota >= 0),
  max_weekly_hours numeric(5, 2) check (max_weekly_hours is null or max_weekly_hours >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create index employees_org_id_idx on public.employees (org_id);
create index employees_user_id_idx on public.employees (user_id) where user_id is not null;

create table public.employee_qualifications (
  org_id uuid not null,
  employee_id uuid not null,
  qualification_id uuid not null,
  primary key (employee_id, qualification_id),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (qualification_id, org_id) references public.qualifications (id, org_id) on delete cascade
);

create index employee_qualifications_org_id_idx on public.employee_qualifications (org_id);
create index employee_qualifications_qualification_id_idx on public.employee_qualifications (qualification_id);

create table public.employee_sites (
  org_id uuid not null,
  employee_id uuid not null,
  site_id uuid not null,
  primary key (employee_id, site_id),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

create index employee_sites_org_id_idx on public.employee_sites (org_id);
create index employee_sites_site_id_idx on public.employee_sites (site_id);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  name text not null,
  starts_at time not null,
  ends_at time not null,
  required_role text not null default '',
  position integer not null default 0,
  unique (id, org_id),
  unique (site_id, name),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

create index shifts_org_id_idx on public.shifts (org_id);
create index shifts_site_id_idx on public.shifts (site_id);

create table public.shift_requirements (
  org_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  required_count integer not null check (required_count >= 0),
  primary key (shift_id, weekday),
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade
);

create index shift_requirements_org_id_idx on public.shift_requirements (org_id);

-- Agreement grid. A missing cell means the contract forbids that shift.
-- This is not weekly availability.
create table public.employee_agreements (
  org_id uuid not null,
  employee_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  primary key (employee_id, shift_id, weekday),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade
);

create index employee_agreements_org_id_idx on public.employee_agreements (org_id);
create index employee_agreements_shift_id_idx on public.employee_agreements (shift_id);

create table public.employee_preferences (
  org_id uuid not null,
  employee_id uuid not null,
  shift_id uuid not null,
  primary key (employee_id, shift_id),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade
);

create index employee_preferences_org_id_idx on public.employee_preferences (org_id);
create index employee_preferences_shift_id_idx on public.employee_preferences (shift_id);

-- A row means the employee submitted availability for that week.
-- Days with no entries are submitted as unavailable. No row at all means
-- "not submitted", which the engine still treats as available per contract.
create table public.availability_weeks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  employee_id uuid not null,
  week_start date not null check (extract(dow from week_start) = 0),
  unique (id, org_id),
  unique (site_id, employee_id, week_start),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

create index availability_weeks_org_id_idx on public.availability_weeks (org_id);

create table public.availability_entries (
  org_id uuid not null,
  availability_week_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  primary key (availability_week_id, shift_id, weekday),
  foreign key (availability_week_id, org_id) references public.availability_weeks (id, org_id) on delete cascade,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade
);

create index availability_entries_org_id_idx on public.availability_entries (org_id);
create index availability_entries_shift_id_idx on public.availability_entries (shift_id);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  week_start date not null check (extract(dow from week_start) = 0),
  status text not null check (status in ('draft', 'published')),
  unique (id, org_id),
  unique (site_id, week_start),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

create index schedules_org_id_idx on public.schedules (org_id);

create table public.assignments (
  org_id uuid not null,
  schedule_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  employee_id uuid not null,
  primary key (schedule_id, shift_id, weekday, employee_id),
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

create index assignments_org_id_idx on public.assignments (org_id);
create index assignments_employee_id_idx on public.assignments (employee_id);

create table public.assignment_extensions (
  org_id uuid not null,
  schedule_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  employee_id uuid not null,
  start_hour numeric(6, 2) not null,
  end_hour numeric(6, 2) not null,
  group_id text not null,
  cover_shift_id uuid not null,
  cover_weekday smallint not null check (cover_weekday between 0 and 6),
  group_size integer not null check (group_size > 0),
  primary key (schedule_id, shift_id, weekday, employee_id),
  foreign key (schedule_id, shift_id, weekday, employee_id)
    references public.assignments (schedule_id, shift_id, weekday, employee_id) on delete cascade,
  foreign key (cover_shift_id, org_id) references public.shifts (id, org_id) on delete cascade,
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade
);

create index assignment_extensions_org_id_idx on public.assignment_extensions (org_id);
create index assignment_extensions_cover_shift_id_idx on public.assignment_extensions (cover_shift_id);

create table public.assignment_locks (
  org_id uuid not null,
  schedule_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  employee_id uuid not null,
  primary key (schedule_id, shift_id, weekday, employee_id),
  foreign key (schedule_id, shift_id, weekday, employee_id)
    references public.assignments (schedule_id, shift_id, weekday, employee_id) on delete cascade,
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade
);

create index assignment_locks_org_id_idx on public.assignment_locks (org_id);

create table public.assignment_overages (
  org_id uuid not null,
  schedule_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  employee_id uuid not null,
  primary key (schedule_id, shift_id, weekday, employee_id),
  foreign key (schedule_id, shift_id, weekday, employee_id)
    references public.assignments (schedule_id, shift_id, weekday, employee_id) on delete cascade,
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade
);

create index assignment_overages_org_id_idx on public.assignment_overages (org_id);

-- Security definer so the membership lookup does not recurse through RLS.
-- Not placed in public, which is exposed by the Data API.
create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships
    where org_id = target_org
      and user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_org_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant usage on schema public to authenticated;

do $policies$
declare
  table_name text;
begin
  for table_name in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon', table_name);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      table_name
    );
    if table_name = 'organizations' then
      execute format(
        'create policy member_all on public.%I for all to authenticated using ((select private.is_org_member(id))) with check ((select private.is_org_member(id)))',
        table_name
      );
    else
      execute format(
        'create policy member_all on public.%I for all to authenticated using ((select private.is_org_member(org_id))) with check ((select private.is_org_member(org_id)))',
        table_name
      );
    end if;
  end loop;
end
$policies$;

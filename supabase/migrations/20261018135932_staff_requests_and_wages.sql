-- Employees submit a constraint request. It stays pending until a shift manager
-- approves it. Each site chooses whether employees sign in at all, and the hours
-- when a request is accepted. Hourly wage is part of the agreement.

alter table public.sites
  add column staff_access boolean not null default true,
  add column constraint_days smallint[] not null default '{0,1,2,3,4,5,6}',
  add column constraint_opens time not null default '00:00',
  add column constraint_closes time not null default '23:59';

alter table public.sites
  drop constraint if exists sites_constraint_days_check;

alter table public.sites
  add constraint sites_constraint_days_check
  check (constraint_days <@ array[0,1,2,3,4,5,6]::smallint[]);

alter table public.employees
  add column hourly_wage numeric(8, 2) not null default 0 check (hourly_wage >= 0);

create table public.availability_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  employee_id uuid not null,
  week_start date not null check (extract(dow from week_start) = 0),
  status text not null check (status in ('pending', 'approved', 'rejected')),
  shifts jsonb not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

create unique index availability_requests_one_pending_idx
  on public.availability_requests (site_id, employee_id, week_start)
  where status = 'pending';

create index availability_requests_site_idx on public.availability_requests (site_id, status);

alter table public.availability_requests enable row level security;
alter table public.availability_requests force row level security;
revoke all on table public.availability_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.availability_requests to authenticated;

create or replace function private.constraint_window_open(target_site uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites s
    where s.id = target_site
      and s.staff_access
      and extract(dow from (now() at time zone s.timezone))::int = any (s.constraint_days)
      and (
        case
          when s.constraint_closes >= s.constraint_opens then
            date_trunc('minute', now() at time zone s.timezone)::time >= s.constraint_opens
            and date_trunc('minute', now() at time zone s.timezone)::time <= s.constraint_closes
          else
            date_trunc('minute', now() at time zone s.timezone)::time >= s.constraint_opens
            or date_trunc('minute', now() at time zone s.timezone)::time <= s.constraint_closes
        end
      )
  );
$$;

revoke all on function private.constraint_window_open(uuid) from public, anon;
grant execute on function private.constraint_window_open(uuid) to authenticated;

create policy availability_requests_read on public.availability_requests
for select to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
);

create policy availability_requests_insert on public.availability_requests
for insert to authenticated
with check (
  (select private.owns_employee(employee_id, org_id))
  and (select private.constraint_window_open(site_id))
  and exists (
    select 1
    from public.employee_sites es
    where es.employee_id = availability_requests.employee_id
      and es.site_id = availability_requests.site_id
      and es.org_id = availability_requests.org_id
  )
);

create policy availability_requests_delete on public.availability_requests
for delete to authenticated
using (
  status = 'pending'
  and (select private.owns_employee(employee_id, org_id))
  and (select private.constraint_window_open(site_id))
);

create policy availability_requests_update on public.availability_requests
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

drop policy availability_weeks_all on public.availability_weeks;
create policy availability_weeks_read on public.availability_weeks
for select to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
);
create policy availability_weeks_write on public.availability_weeks
for all to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

drop policy availability_entries_all on public.availability_entries;
create policy availability_entries_read on public.availability_entries
for select to authenticated
using (
  (select private.is_manager(org_id))
  or exists (
    select 1
    from public.availability_weeks
    where availability_weeks.id = availability_entries.availability_week_id
      and availability_weeks.org_id = availability_entries.org_id
      and (
        (select private.is_manager(availability_weeks.org_id))
        or (select private.owns_employee(availability_weeks.employee_id, availability_weeks.org_id))
      )
  )
);
create policy availability_entries_write on public.availability_entries
for all to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profiles.user_id
  )
  or (
    (select private.is_platform_admin())
    and exists (
      select 1
      from public.memberships member
      where member.user_id = profiles.user_id
        and member.org_id::text = nullif(current_setting('app.support_org', true), '')
    )
  )
);

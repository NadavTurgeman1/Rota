create table public.constraint_grants (
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  employee_id uuid not null,
  week_start date not null check (extract(dow from week_start) = 0),
  primary key (site_id, employee_id, week_start),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

comment on table public.constraint_grants is
  'A manager let this employee ignore the weekly block cap for one week. The submission is saved at once.';

create index constraint_grants_org_id_idx on public.constraint_grants (org_id);
create index constraint_grants_site_id_org_id_idx on public.constraint_grants (site_id, org_id);
create index constraint_grants_employee_id_org_id_idx on public.constraint_grants (employee_id, org_id);

alter table public.constraint_grants enable row level security;

revoke all on table public.constraint_grants from public, anon;
grant select on table public.constraint_grants to authenticated;

create policy constraint_grants_read on public.constraint_grants
for select to authenticated
using (
  (select private.manages_site(site_id))
  or exists (
    select 1
    from public.employees e
    where e.id = employee_id
      and e.user_id = (select auth.uid())
  )
);

alter table public.sites
  add column constraint_extension_until timestamptz;

comment on column public.sites.constraint_extension_until is
  'Extra constraint submission window for every employee. Null or a past time means it is closed.';

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
    cross join lateral (
      select date_trunc('minute', now() at time zone s.timezone) as local_time
    ) clock
    cross join lateral (
      select
        s.constraint_opens_day * 1440
          + extract(hour from s.constraint_opens)::int * 60
          + extract(minute from s.constraint_opens)::int as opens_at,
        s.constraint_closes_day * 1440
          + extract(hour from s.constraint_closes)::int * 60
          + extract(minute from s.constraint_closes)::int as closes_at,
        extract(dow from clock.local_time)::int * 1440
          + extract(hour from clock.local_time)::int * 60
          + extract(minute from clock.local_time)::int as now_at
    ) span
    where s.id = target_site
      and s.staff_access
      and (
        s.constraint_extension_until > now()
        or (
          case
            when span.closes_at >= span.opens_at then span.now_at between span.opens_at and span.closes_at
            else span.now_at >= span.opens_at or span.now_at <= span.closes_at
          end
        )
      )
  );
$$;

create or replace function private.accept_within_limit_availability(target_site uuid, target_week date, shifts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  emp uuid;
  org uuid;
  limited boolean;
  max_blocks integer;
  blocks integer;
  expected integer;
  written integer;
  week_id uuid;
begin
  if actor is null then
    raise exception 'forbidden';
  end if;
  if target_week is null or extract(dow from target_week) <> 0 then
    raise exception 'availability';
  end if;
  if shifts is null or jsonb_typeof(shifts) <> 'array' or jsonb_array_length(shifts) <> 7 then
    raise exception 'availability';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(shifts) as day(cells)
    where jsonb_typeof(day.cells) <> 'array'
  ) then
    raise exception 'availability';
  end if;

  select e.id, e.org_id into emp, org
  from public.employees e
  join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
  where e.user_id = actor and es.site_id = target_site;
  if emp is null then
    raise exception 'forbidden';
  end if;
  if not (select private.constraint_window_open(target_site)) then
    raise exception 'window';
  end if;

  select s.constraint_block_limit, s.constraint_max_blocks::int into limited, max_blocks
  from public.sites s
  where s.id = target_site;
  if limited is not true then
    raise exception 'blocks';
  end if;

  select count(*)::int into blocks
  from public.employee_agreements a
  join public.shift_requirements r on r.shift_id = a.shift_id and r.weekday = a.weekday
  where a.employee_id = emp
    and r.required_count > 0
    and not exists (
      select 1
      from jsonb_array_elements(shifts) with ordinality as day(cells, idx)
      cross join lateral jsonb_array_elements_text(day.cells) as cell(shift_id)
      where (day.idx - 1) = a.weekday
        and cell.shift_id::uuid = a.shift_id
    );
  if blocks > max_blocks and not exists (
    select 1
    from public.constraint_grants g
    where g.site_id = target_site
      and g.employee_id = emp
      and g.week_start = target_week
      and g.org_id = org
  ) then
    raise exception 'blocks';
  end if;

  insert into public.availability_weeks (org_id, site_id, employee_id, week_start)
  values (org, target_site, emp, target_week)
  on conflict (site_id, employee_id, week_start) do update set week_start = excluded.week_start
  returning id into week_id;

  delete from public.availability_entries where availability_week_id = week_id;

  select count(*)::int into expected
  from jsonb_array_elements(shifts) with ordinality as day(cells, idx)
  cross join lateral jsonb_array_elements_text(day.cells) as cell(shift_id);

  insert into public.availability_entries (org_id, availability_week_id, shift_id, weekday)
  select org, week_id, cell.shift_id::uuid, (day.idx - 1)::smallint
  from jsonb_array_elements(shifts) with ordinality as day(cells, idx)
  cross join lateral jsonb_array_elements_text(day.cells) as cell(shift_id)
  join public.shifts s on s.id = cell.shift_id::uuid and s.site_id = target_site and s.org_id = org;
  get diagnostics written = row_count;
  if written <> expected then
    raise exception 'availability';
  end if;

  delete from public.availability_requests
  where site_id = target_site and employee_id = emp and week_start = target_week and status = 'pending';
end;
$$;

create or replace function private.set_constraint_grant(target_site uuid, target_employee uuid, target_week date, allowed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org uuid;
begin
  if not (select private.manages_site(target_site)) then
    raise exception 'forbidden';
  end if;
  if target_week is null or extract(dow from target_week) <> 0 then
    raise exception 'availability';
  end if;
  select s.org_id into org
  from public.sites s
  join public.employee_sites es on es.site_id = s.id and es.org_id = s.org_id
  where s.id = target_site and es.employee_id = target_employee;
  if org is null then
    raise exception 'forbidden';
  end if;
  if allowed then
    insert into public.constraint_grants (org_id, site_id, employee_id, week_start)
    values (org, target_site, target_employee, target_week)
    on conflict (site_id, employee_id, week_start) do nothing;
  else
    delete from public.constraint_grants
    where site_id = target_site and employee_id = target_employee and week_start = target_week;
  end if;
end;
$$;

create or replace function private.open_constraint_extension(target_site uuid, minutes integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  deadline timestamptz;
begin
  if minutes is null or minutes < 1 or minutes > 1440 then
    raise exception 'window';
  end if;
  update public.sites
  set constraint_extension_until = now() + make_interval(mins => minutes)
  where id = target_site
    and (select private.manages_site(target_site))
  returning constraint_extension_until into deadline;
  if deadline is null then
    raise exception 'forbidden';
  end if;
  return deadline;
end;
$$;

create or replace function private.close_constraint_extension(target_site uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.sites
  set constraint_extension_until = null
  where id = target_site
    and (select private.manages_site(target_site));
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'forbidden';
  end if;
end;
$$;

revoke all on function private.set_constraint_grant(uuid, uuid, date, boolean) from public, anon;
revoke all on function private.open_constraint_extension(uuid, integer) from public, anon;
revoke all on function private.close_constraint_extension(uuid) from public, anon;
grant execute on function private.set_constraint_grant(uuid, uuid, date, boolean) to authenticated;
grant execute on function private.open_constraint_extension(uuid, integer) to authenticated;
grant execute on function private.close_constraint_extension(uuid) to authenticated;

-- Weekly block caps can be one number, weekday plus weekend, or one number per shift.
-- An employee is measured by the primary site, including when submitting on a reinforcement site.

alter table public.sites
  add column constraint_block_split text not null default 'general',
  add column constraint_weekday_blocks integer not null default 0,
  add column constraint_weekend_blocks integer not null default 0,
  add column constraint_shift_blocks jsonb not null default '{}'::jsonb;

alter table public.sites
  add constraint sites_constraint_block_split_check
    check (constraint_block_split in ('general', 'weekday', 'shift')),
  add constraint sites_constraint_weekday_blocks_check
    check (constraint_weekday_blocks >= 0),
  add constraint sites_constraint_weekend_blocks_check
    check (constraint_weekend_blocks >= 0),
  add constraint sites_constraint_shift_blocks_object_check
    check (jsonb_typeof(constraint_shift_blocks) = 'object');

alter table public.employees
  add column constraint_limits jsonb,
  add constraint employees_constraint_limits_object_check
    check (constraint_limits is null or jsonb_typeof(constraint_limits) = 'object');

comment on column public.sites.constraint_block_split is
  'How a block cap is split: general (one weekly number), weekday (Sun-Thu and Fri-Sat), or shift (one number per shift).';
comment on column public.sites.constraint_weekday_blocks is
  'Sunday through Thursday blocks allowed when the split is weekday.';
comment on column public.sites.constraint_weekend_blocks is
  'Friday and Saturday blocks allowed when the split is weekday.';
comment on column public.sites.constraint_shift_blocks is
  'Blocks allowed per shift id across the week when the split is shift.';
comment on column public.employees.constraint_limits is
  'Personal block numbers. Null uses the primary site defaults. The split still comes from that site.';

create or replace function private.shift_kind(starts_at time, ends_at time)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when ends_at <= starts_at
      or extract(hour from starts_at) >= 20
      or extract(hour from starts_at) < 4
    then 'n'
    when extract(hour from starts_at) < 12 then 'm'
    else 'a'
  end;
$$;

create or replace function private.nonneg_int(raw text, fallback integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case when raw ~ '^[0-9]{1,6}$' then raw::integer else fallback end;
$$;

create or replace function private.open_block_cells(emp uuid, target_site uuid, shifts jsonb)
returns table (weekday smallint, shift_id uuid, starts_at time, ends_at time)
language sql
stable
security definer
set search_path = ''
as $$
  select a.weekday, a.shift_id, s.starts_at, s.ends_at
  from public.employee_agreements a
  join public.shifts s on s.id = a.shift_id and s.site_id = target_site
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
  home_site uuid;
  limited boolean;
  split text;
  max_blocks integer;
  weekday_cap integer;
  weekend_cap integer;
  shift_caps jsonb;
  limits jsonb;
  blocks integer;
  weekday_used integer;
  weekend_used integer;
  over_cap boolean;
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

  select e.home_site_id into home_site
  from public.employees e
  where e.id = emp;
  if home_site is null or not exists (
    select 1 from public.employee_sites link
    where link.employee_id = emp and link.site_id = home_site
  ) then
    home_site := target_site;
  end if;

  select
    s.constraint_block_limit,
    s.constraint_block_split,
    s.constraint_max_blocks::int,
    s.constraint_weekday_blocks,
    s.constraint_weekend_blocks,
    s.constraint_shift_blocks
  into limited, split, max_blocks, weekday_cap, weekend_cap, shift_caps
  from public.sites s
  where s.id = home_site;
  if limited is not true then
    raise exception 'blocks';
  end if;
  if split is null or split not in ('general', 'weekday', 'shift') then
    split := 'general';
  end if;

  select e.constraint_limits into limits
  from public.employees e
  where e.id = emp;
  if limits is not null and limits->>'custom' = 'true' then
    max_blocks := private.nonneg_int(limits->>'max', max_blocks);
    weekday_cap := private.nonneg_int(limits->>'weekday', weekday_cap);
    weekend_cap := private.nonneg_int(limits->>'weekend', weekend_cap);
    if jsonb_typeof(limits->'shifts') = 'object' then
      shift_caps := limits->'shifts';
    end if;
  end if;

  if not exists (
    select 1
    from public.constraint_grants g
    where g.site_id = target_site
      and g.employee_id = emp
      and g.week_start = target_week
      and g.org_id = org
  ) then
    if split = 'general' then
      select count(*)::int into blocks
      from private.open_block_cells(emp, target_site, shifts);
      over_cap := blocks > max_blocks;
    elsif split = 'weekday' then
      select
        count(*) filter (where cell.weekday < 5)::int,
        count(*) filter (where cell.weekday >= 5)::int
      into weekday_used, weekend_used
      from private.open_block_cells(emp, target_site, shifts) as cell;
      over_cap := weekday_used > weekday_cap or weekend_used > weekend_cap;
    else
      select exists (
        select 1
        from (
          select matched.home_shift, count(*)::int as used
          from (
            select (
              case
                when exists (
                  select 1 from public.shifts h
                  where h.id = cell.shift_id and h.site_id = home_site
                ) then cell.shift_id
                else (
                  select h.id
                  from public.shifts h
                  where h.site_id = home_site
                    and private.shift_kind(h.starts_at, h.ends_at) = private.shift_kind(cell.starts_at, cell.ends_at)
                  order by abs(extract(epoch from (h.starts_at - cell.starts_at))), h.position, h.id
                  limit 1
                )
              end
            ) as home_shift
            from private.open_block_cells(emp, target_site, shifts) as cell
          ) matched
          group by matched.home_shift
        ) tallies
        where tallies.home_shift is null
          or tallies.used > private.nonneg_int(shift_caps ->> tallies.home_shift::text, 0)
      ) into over_cap;
    end if;
    if over_cap then
      raise exception 'blocks';
    end if;
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

revoke all on function private.shift_kind(time, time) from public, anon, authenticated;
revoke all on function private.nonneg_int(text, integer) from public, anon, authenticated;
revoke all on function private.open_block_cells(uuid, uuid, jsonb) from public, anon, authenticated;

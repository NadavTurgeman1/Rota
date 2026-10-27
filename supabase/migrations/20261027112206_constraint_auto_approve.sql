alter table public.availability_requests
  add column exception boolean not null default false;

comment on column public.availability_requests.exception is
  'The employee asked to block more shifts than the weekly cap. A manager approves it only when enough open shifts remain for the weekly quota.';

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
  if blocks > max_blocks then
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

revoke all on function private.accept_within_limit_availability(uuid, date, jsonb) from public, anon;
grant execute on function private.accept_within_limit_availability(uuid, date, jsonb) to authenticated;

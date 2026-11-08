-- A manager of one employee can add a missed clock-in or clock-out, and can change its time.
-- punched_at stays the time that counts. The first time is kept in original_punched_at.

alter table public.attendance_punches
  add column source text not null default 'device',
  add column original_punched_at timestamptz,
  add column adjusted_at timestamptz,
  add column adjusted_by uuid references auth.users (id) on delete set null;

alter table public.attendance_punches
  alter column device_at drop not null,
  alter column device_offset_minutes drop not null,
  alter column latitude drop not null,
  alter column longitude drop not null,
  alter column accuracy_meters drop not null;

alter table public.attendance_punches
  drop constraint attendance_punches_position_check;

alter table public.attendance_punches
  add constraint attendance_punches_source_check check (source in ('device', 'manager')),
  add constraint attendance_punches_position_check check (
    (
      source = 'device'
      and device_at is not null
      and device_offset_minutes is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
      and accuracy_meters >= 0
      and accuracy_meters <= 100
    )
    or (
      source = 'manager'
      and device_at is null
      and device_offset_minutes is null
      and latitude is null
      and longitude is null
      and accuracy_meters is null
    )
  ),
  add constraint attendance_punches_original_check check (
    original_punched_at is null or original_punched_at <> punched_at
  );

comment on column public.attendance_punches.source is
  'device: a phone punch with GPS. manager: added or only stored from the team screen.';
comment on column public.attendance_punches.original_punched_at is
  'The first time that counted, kept when a manager changes punched_at. Cleared if the time is restored to it.';
comment on table public.attendance_punches is
  'Clock-in and clock-out. punched_at is the time that counts. A manager correction keeps the first time in original_punched_at.';

create or replace function private.correct_attendance(
  target_employee uuid,
  target_action text,
  target_site uuid,
  target_kind text,
  target_punch uuid,
  target_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  emp_org uuid;
  emp_user uuid;
  punch_employee uuid;
  punch_source text;
  punch_original timestamptz;
  punch_at timestamptz;
  open_shift boolean := false;
  previous_at timestamptz := null;
  row_kind text;
  row_at timestamptz;
  created uuid;
begin
  if target_action not in ('add', 'adjust', 'remove') then
    raise exception 'kind' using errcode = '22023';
  end if;

  select e.org_id, e.user_id into emp_org, emp_user
  from public.employees e
  where e.id = target_employee
  for update;

  if emp_org is null
     or emp_user is not distinct from (select auth.uid())
     or not (
       (select private.org_role(emp_org)) = 'owner'
       or (select private.oversees(emp_org, target_employee))
     ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if target_action = 'add' then
    if target_kind not in ('in', 'out') or target_site is null or target_at is null then
      raise exception 'kind' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.sites s
      where s.id = target_site and s.org_id = emp_org
    ) or not exists (
      select 1 from public.employee_sites es
      where es.employee_id = target_employee and es.org_id = emp_org and es.site_id = target_site
      union all
      select 1 from public.employee_managed_sites ms
      where ms.employee_id = target_employee and ms.org_id = emp_org and ms.site_id = target_site
      union all
      select 1 from public.employees person
      where person.id = target_employee and person.home_site_id = target_site
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    select p.employee_id, p.source, p.original_punched_at, p.punched_at
      into punch_employee, punch_source, punch_original, punch_at
    from public.attendance_punches p
    where p.id = target_punch and p.org_id = emp_org
    for update;
    if punch_employee is distinct from target_employee then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if target_action = 'adjust' and target_at is null then
      raise exception 'kind' using errcode = '22023';
    end if;
    if target_action = 'remove' and punch_source is distinct from 'manager' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if target_action in ('add', 'adjust') then
    if target_at > clock_timestamp() + interval '2 minutes' then
      raise exception 'future' using errcode = 'P0001';
    end if;
    if target_at < clock_timestamp() - interval '90 days' then
      raise exception 'old' using errcode = 'P0001';
    end if;
    if target_action = 'adjust' and target_at = punch_at then
      return target_punch;
    end if;
  end if;

  for row_kind, row_at in
    select proposed.kind, proposed.at
    from (
      select p.kind,
        case
          when target_action = 'remove' and p.id = target_punch then null
          when target_action = 'adjust' and p.id = target_punch then target_at
          else p.punched_at
        end as at,
        p.id
      from public.attendance_punches p
      where p.employee_id = target_employee and p.org_id = emp_org
      union all
      select target_kind, target_at, null::uuid
      where target_action = 'add'
    ) proposed
    where proposed.at is not null
    order by proposed.at, proposed.id nulls last
  loop
    if previous_at is not null and row_at = previous_at then
      raise exception 'duplicate' using errcode = 'P0001';
    end if;
    if row_kind = 'in' then
      if open_shift then
        raise exception 'open' using errcode = 'P0001';
      end if;
      open_shift := true;
    else
      if not open_shift then
        raise exception 'closed' using errcode = 'P0001';
      end if;
      open_shift := false;
    end if;
    previous_at := row_at;
  end loop;

  if target_action = 'add' then
    insert into public.attendance_punches (
      org_id, site_id, employee_id, kind, punched_at, source, adjusted_at, adjusted_by
    ) values (
      emp_org, target_site, target_employee, target_kind, target_at, 'manager', clock_timestamp(), (select auth.uid())
    )
    returning id into created;
    return created;
  end if;

  if target_action = 'remove' then
    delete from public.attendance_punches where id = target_punch;
    return target_punch;
  end if;

  if punch_original is not null and target_at = punch_original then
    update public.attendance_punches
    set punched_at = target_at,
        original_punched_at = null,
        adjusted_at = null,
        adjusted_by = null
    where id = target_punch;
  else
    update public.attendance_punches
    set original_punched_at = coalesce(original_punched_at, punched_at),
        punched_at = target_at,
        adjusted_at = clock_timestamp(),
        adjusted_by = (select auth.uid())
    where id = target_punch;
  end if;
  return target_punch;
end;
$$;

revoke all on function private.correct_attendance(uuid, text, uuid, text, uuid, timestamptz) from public, anon;
grant execute on function private.correct_attendance(uuid, text, uuid, text, uuid, timestamptz) to authenticated;

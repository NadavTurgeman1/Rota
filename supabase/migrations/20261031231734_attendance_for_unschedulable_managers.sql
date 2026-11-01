create or replace function private.attendance_employee(target_site uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  join public.sites s on s.id = target_site and s.org_id = e.org_id
  where e.user_id = (select auth.uid())
    and private.has_capability(s.org_id, 'clock')
    and (
      exists (
        select 1 from public.employee_sites es
        where es.employee_id = e.id and es.site_id = s.id
      )
      or exists (
        select 1 from public.employee_managed_sites ms
        where ms.employee_id = e.id and ms.site_id = s.id
      )
      or (select private.org_role(s.org_id)) in ('owner', 'manager')
    )
  limit 1;
$$;

revoke all on function private.attendance_employee(uuid) from public, anon;
grant execute on function private.attendance_employee(uuid) to authenticated;

create or replace function private.record_attendance_punch(
  target_site uuid,
  target_kind text,
  device_at timestamptz,
  device_offset_minutes integer,
  target_latitude double precision,
  target_longitude double precision,
  target_accuracy double precision
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
  site_org uuid;
  site_tz text;
  expected integer;
  last_kind text;
  created uuid;
begin
  if target_kind not in ('in', 'out') then
    raise exception 'kind' using errcode = '22023';
  end if;
  if target_latitude is null or target_longitude is null or target_accuracy is null
     or target_latitude <> target_latitude
     or target_longitude <> target_longitude
     or target_accuracy <> target_accuracy
     or target_latitude < -90 or target_latitude > 90
     or target_longitude < -180 or target_longitude > 180
     or target_accuracy < 0 then
    raise exception 'location' using errcode = 'P0001';
  end if;
  if target_accuracy > 100 then
    raise exception 'accuracy' using errcode = 'P0001';
  end if;

  select org_id, timezone into site_org, site_tz
  from public.sites
  where id = target_site;
  actor := private.attendance_employee(target_site);
  if site_org is null or actor is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if device_at is null or abs(extract(epoch from (device_at - clock_timestamp()))) > 120 then
    raise exception 'clock' using errcode = 'P0001';
  end if;
  expected := round((
    extract(epoch from (clock_timestamp() at time zone site_tz))
    - extract(epoch from (clock_timestamp() at time zone 'UTC'))
  ) / 60)::integer;
  if device_offset_minutes is distinct from expected then
    raise exception 'timezone' using errcode = 'P0001';
  end if;

  perform 1
  from public.employees
  where id = actor and org_id = site_org
  for update;

  select kind into last_kind
  from public.attendance_punches
  where org_id = site_org and employee_id = actor
  order by punched_at desc, id desc
  limit 1;
  if target_kind = 'in' and last_kind = 'in' then
    raise exception 'open' using errcode = 'P0001';
  end if;
  if target_kind = 'out' and last_kind is distinct from 'in' then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  insert into public.attendance_punches (
    org_id, site_id, employee_id, kind, punched_at, device_at, device_offset_minutes,
    latitude, longitude, accuracy_meters
  ) values (
    site_org, target_site, actor, target_kind, clock_timestamp(), device_at, device_offset_minutes,
    target_latitude, target_longitude, target_accuracy
  )
  returning id into created;
  return created;
end;
$$;

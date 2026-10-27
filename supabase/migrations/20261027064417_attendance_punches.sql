-- Append-only clock-in and clock-out log. It is not the shift schedule.
-- punched_at is the server clock. The phone clock is stored beside it and must agree
-- with the server and with the site timezone before a punch is accepted.
-- The only writer is private.record_attendance_punch. Rows are never updated or deleted.

create table public.attendance_punches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  employee_id uuid not null,
  kind text not null check (kind in ('in', 'out')),
  punched_at timestamptz not null,
  device_at timestamptz not null,
  device_offset_minutes integer not null,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision not null,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  constraint attendance_punches_position_check check (
    latitude between -90 and 90
    and longitude between -180 and 180
    and accuracy_meters >= 0
    and accuracy_meters <= 150
  )
);

create index attendance_punches_employee_idx on public.attendance_punches (org_id, employee_id, punched_at desc);
create index attendance_punches_site_idx on public.attendance_punches (site_id, org_id);

comment on table public.attendance_punches is
  'One clock-in or clock-out by a roster person. Separate from shift assignments. Append-only: the server clock and the GPS fix are the record.';
comment on column public.attendance_punches.punched_at is
  'When the server accepted the punch. This is the time that counts, not the phone clock.';
comment on column public.attendance_punches.device_at is
  'What the phone clock said at the punch. It has to be within two minutes of punched_at.';
comment on column public.attendance_punches.device_offset_minutes is
  'The phone timezone offset, minutes east of UTC. It has to match the site timezone.';
comment on column public.attendance_punches.accuracy_meters is
  'GPS accuracy reported by the phone. A punch wider than 150 meters is refused.';

alter table public.attendance_punches enable row level security;
alter table public.attendance_punches force row level security;

revoke all on table public.attendance_punches from public, anon, authenticated;
grant select on table public.attendance_punches to authenticated;

create policy attendance_punches_select on public.attendance_punches
for select to authenticated
using (
  (select private.owns_employee(employee_id, org_id))
  or (select private.org_role(org_id)) = 'owner'
  or (select private.manages_site(site_id))
);

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
  if target_accuracy > 150 then
    raise exception 'accuracy' using errcode = 'P0001';
  end if;

  select org_id, timezone into site_org, site_tz
  from public.sites
  where id = target_site;
  actor := private.site_employee(target_site);
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

revoke all on function private.record_attendance_punch(uuid, text, timestamptz, integer, double precision, double precision, double precision) from public, anon;
grant execute on function private.record_attendance_punch(uuid, text, timestamptz, integer, double precision, double precision, double precision) to authenticated;

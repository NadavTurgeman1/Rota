-- Sentinel Security demo, matching the employees and shifts in Rota.html.
-- No auth users: memberships are created when someone actually signs in.

insert into public.organizations (id, name, slug, kind)
values (
  '11111111-1111-4111-8111-111111111111',
  'Sentinel Security',
  'sentinel-security',
  'Security company'
);

insert into public.sites (
  id,
  org_id,
  name,
  timezone,
  min_rest_hours,
  max_weekly_hours,
  max_shift_hours,
  assume_available
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Headquarters',
  'Asia/Jerusalem',
  11,
  48,
  12,
  true
);

insert into public.shifts (id, org_id, site_id, name, starts_at, ends_at, required_role, position)
values
  ('33333333-3333-4333-8333-333333333301', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Morning', '06:00', '14:00', '', 0),
  ('33333333-3333-4333-8333-333333333302', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Afternoon', '14:00', '22:00', '', 1),
  ('33333333-3333-4333-8333-333333333303', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Night', '22:00', '06:00', '', 2);

insert into public.shift_requirements (org_id, shift_id, weekday, required_count)
select
  s.org_id,
  s.id,
  day.weekday::smallint,
  case s.name when 'Night' then 1 else 2 end
from public.shifts s
cross join generate_series(0, 6) as day(weekday)
where s.site_id = '22222222-2222-4222-8222-222222222222';

insert into public.employees (id, org_id, name, contact, job_title, weekly_shift_quota)
values
  ('44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111111', 'Dana', 'dana@example.com', 'Guard', 4),
  ('44444444-4444-4444-8444-444444444402', '11111111-1111-4111-8111-111111111111', 'Yossi', 'yossi@example.com', 'Guard', 5),
  ('44444444-4444-4444-8444-444444444403', '11111111-1111-4111-8111-111111111111', 'Maya', 'maya@example.com', 'Guard', 5),
  ('44444444-4444-4444-8444-444444444404', '11111111-1111-4111-8111-111111111111', 'Omer', 'omer@example.com', 'Guard', 5),
  ('44444444-4444-4444-8444-444444444405', '11111111-1111-4111-8111-111111111111', 'Noa', 'noa@example.com', 'Guard', 5),
  ('44444444-4444-4444-8444-444444444406', '11111111-1111-4111-8111-111111111111', 'Eli', 'eli@example.com', 'Guard', 4),
  ('44444444-4444-4444-8444-444444444407', '11111111-1111-4111-8111-111111111111', 'Tal', 'tal@example.com', 'Guard', 4),
  ('44444444-4444-4444-8444-444444444408', '11111111-1111-4111-8111-111111111111', 'Ron', 'ron@example.com', 'Guard', 4);

insert into public.employee_sites (org_id, employee_id, site_id)
select org_id, id, '22222222-2222-4222-8222-222222222222'
from public.employees
where org_id = '11111111-1111-4111-8111-111111111111';

insert into public.employee_agreements (org_id, employee_id, shift_id, weekday)
select e.org_id, e.id, s.id, day.weekday::smallint
from public.employees e
join public.shifts s on s.site_id = '22222222-2222-4222-8222-222222222222'
cross join generate_series(0, 6) as day(weekday)
where e.org_id = '11111111-1111-4111-8111-111111111111'
  and not (e.name = 'Maya' and day.weekday = 6)
  and not (e.name = 'Ron' and day.weekday = 5)
  and not (e.name = 'Dana' and s.name = 'Night')
  and not (e.name = 'Eli' and s.name = 'Morning');

insert into public.employee_preferences (org_id, employee_id, shift_id)
select e.org_id, e.id, s.id
from public.employees e
join public.shifts s on s.site_id = '22222222-2222-4222-8222-222222222222'
where (e.name = 'Maya' and s.name = 'Morning')
   or (e.name = 'Omer' and s.name = 'Night');

-- Dana submitted this week: Sunday and Monday only.
insert into public.availability_weeks (id, org_id, site_id, employee_id, week_start)
values (
  '55555555-5555-4555-8555-555555555501',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444401',
  '2026-10-04'
);

insert into public.availability_entries (org_id, availability_week_id, shift_id, weekday)
select
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555501',
  s.id,
  day.weekday::smallint
from public.shifts s
cross join generate_series(0, 1) as day(weekday)
where s.site_id = '22222222-2222-4222-8222-222222222222';

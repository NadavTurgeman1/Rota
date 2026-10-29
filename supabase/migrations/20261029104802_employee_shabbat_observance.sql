alter table public.employees
  add column observes_shabbat boolean not null default false,
  add column observes_holidays boolean not null default false;

alter table public.employees
  add constraint employees_observes_holidays_check
  check (observes_holidays = false or observes_shabbat = true);

comment on column public.employees.observes_shabbat is
  'No shift from Friday 15:00 through Saturday 21:00.';
comment on column public.employees.observes_holidays is
  'No shift on Israeli festival days from 15:00 the day before through 21:00 that day. Requires observes_shabbat.';

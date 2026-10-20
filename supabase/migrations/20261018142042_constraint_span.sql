-- The constraint window is one span: a start weekday and time through an end weekday and time.

alter table public.sites
  add column constraint_opens_day smallint not null default 0,
  add column constraint_closes_day smallint not null default 6;

alter table public.sites
  drop constraint if exists sites_constraint_opens_day_check,
  drop constraint if exists sites_constraint_closes_day_check;

alter table public.sites
  add constraint sites_constraint_opens_day_check check (constraint_opens_day between 0 and 6),
  add constraint sites_constraint_closes_day_check check (constraint_closes_day between 0 and 6);

update public.sites
set
  constraint_opens_day = coalesce((select min(day) from unnest(constraint_days) as day), 0),
  constraint_closes_day = coalesce((select max(day) from unnest(constraint_days) as day), 6);

alter table public.sites drop constraint if exists sites_constraint_days_check;
alter table public.sites drop column constraint_days;

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
        case
          when span.closes_at >= span.opens_at then span.now_at between span.opens_at and span.closes_at
          else span.now_at >= span.opens_at or span.now_at <= span.closes_at
        end
      )
  );
$$;

-- Employees ask to swap a published shift with a colleague, or to give it away.
-- The colleague answers, then a shift manager approves. Employees only read
-- this table; every change goes through the functions below, called by the server
-- after it has checked the constraints and site rules.

create table public.shift_trades (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  week_start date not null check (extract(dow from week_start) = 0),
  kind text not null check (kind in ('swap', 'giveaway')),
  requester_id uuid not null,
  offered_shift_id uuid not null,
  offered_weekday smallint not null check (offered_weekday between 0 and 6),
  target_id uuid,
  target_shift_id uuid,
  target_weekday smallint check (target_weekday between 0 and 6),
  status text not null default 'open'
    check (status in ('open', 'accepted', 'approved', 'rejected', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  decided_at timestamptz,
  decided_by uuid,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  foreign key (requester_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (target_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (offered_shift_id, org_id) references public.shifts (id, org_id) on delete cascade,
  foreign key (target_shift_id, org_id) references public.shifts (id, org_id) on delete cascade,
  check ((kind = 'swap') = (target_shift_id is not null and target_weekday is not null)),
  check (kind = 'giveaway' or target_id is not null),
  check (target_id is null or target_id <> requester_id)
);

create unique index shift_trades_one_open_idx
  on public.shift_trades (site_id, week_start, offered_shift_id, offered_weekday, requester_id)
  where status in ('open', 'accepted');

create index shift_trades_site_idx on public.shift_trades (site_id, status);

alter table public.shift_trades enable row level security;
alter table public.shift_trades force row level security;
revoke all on table public.shift_trades from public, anon, authenticated;
grant select on table public.shift_trades to authenticated;

create policy shift_trades_read on public.shift_trades
for select to authenticated
using (
  (select private.manages_site(site_id))
  or (select private.owns_employee(requester_id, org_id))
  or (target_id is not null and (select private.owns_employee(target_id, org_id)))
  or (kind = 'giveaway' and status = 'open' and (select private.site_member(site_id, org_id)))
);

alter table public.schedule_versions drop constraint schedule_versions_reason_check;
alter table public.schedule_versions
  add constraint schedule_versions_reason_check check (reason in ('publish', 'calloff', 'trade'));

-- The roster person linked to the signed-in login at this site.
create or replace function private.site_employee(target_site uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  join public.employee_sites es on es.employee_id = e.id and es.org_id = e.org_id
  where e.user_id = (select auth.uid())
    and es.site_id = target_site
  limit 1;
$$;

-- True when the person holds the seat on the published week.
create or replace function private.holds_published_seat(
  target_site uuid,
  target_week date,
  target_shift uuid,
  target_day smallint,
  target_employee uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedules s
    join public.assignments a on a.schedule_id = s.id
    where s.site_id = target_site
      and s.week_start = target_week
      and s.status = 'published'
      and a.shift_id = target_shift
      and a.weekday = target_day
      and a.employee_id = target_employee
  );
$$;

create or replace function private.create_shift_trade(
  target_site uuid,
  target_week date,
  trade_kind text,
  offered_shift uuid,
  offered_day smallint,
  other_employee uuid,
  other_shift uuid,
  other_day smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.site_employee(target_site);
  site_org uuid;
  created uuid;
begin
  if actor is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select org_id into site_org from public.sites where id = target_site;
  if not private.holds_published_seat(target_site, target_week, offered_shift, offered_day, actor) then
    raise exception 'stale' using errcode = 'P0001';
  end if;
  if trade_kind = 'swap' then
    if other_employee is null or other_employee = actor
      or not private.holds_published_seat(target_site, target_week, other_shift, other_day, other_employee) then
      raise exception 'stale' using errcode = 'P0001';
    end if;
  elsif trade_kind = 'giveaway' then
    other_employee := null;
    other_shift := null;
    other_day := null;
  else
    raise exception 'kind' using errcode = '22023';
  end if;
  insert into public.shift_trades (
    org_id, site_id, week_start, kind, requester_id, offered_shift_id, offered_weekday,
    target_id, target_shift_id, target_weekday
  ) values (
    site_org, target_site, target_week, trade_kind, actor, offered_shift, offered_day,
    other_employee, other_shift, other_day
  )
  returning id into created;
  return created;
end;
$$;

-- The colleague answers a swap, or someone at the site takes a giveaway.
create or replace function private.answer_shift_trade(target_trade uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trade public.shift_trades%rowtype;
  actor uuid;
begin
  select * into trade from public.shift_trades where id = target_trade for update;
  if not found or trade.status <> 'open' then
    raise exception 'stale' using errcode = 'P0001';
  end if;
  actor := private.site_employee(trade.site_id);
  if actor is null or actor = trade.requester_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not private.holds_published_seat(trade.site_id, trade.week_start, trade.offered_shift_id, trade.offered_weekday, trade.requester_id) then
    raise exception 'stale' using errcode = 'P0001';
  end if;
  if trade.kind = 'swap' then
    if trade.target_id <> actor then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if accept and not private.holds_published_seat(trade.site_id, trade.week_start, trade.target_shift_id, trade.target_weekday, actor) then
      raise exception 'stale' using errcode = 'P0001';
    end if;
    update public.shift_trades
    set status = case when accept then 'accepted' else 'declined' end, answered_at = now()
    where id = trade.id;
  else
    if not accept then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    update public.shift_trades
    set status = 'accepted', target_id = actor, answered_at = now()
    where id = trade.id;
  end if;
end;
$$;

create or replace function private.cancel_shift_trade(target_trade uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trade public.shift_trades%rowtype;
begin
  select * into trade from public.shift_trades where id = target_trade for update;
  if not found or trade.status not in ('open', 'accepted') then
    raise exception 'stale' using errcode = 'P0001';
  end if;
  if not private.owns_employee(trade.requester_id, trade.org_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.shift_trades set status = 'cancelled', decided_at = now() where id = trade.id;
end;
$$;

-- A shift manager of the site closes a trade both people agreed to.
-- The server rewrites the week in the same transaction before approving.
create or replace function private.decide_shift_trade(target_trade uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  trade public.shift_trades%rowtype;
begin
  select * into trade from public.shift_trades where id = target_trade for update;
  if not found or trade.status <> 'accepted' then
    raise exception 'stale' using errcode = 'P0001';
  end if;
  if not private.manages_site(trade.site_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.shift_trades
  set status = case when approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = (select auth.uid())
  where id = trade.id;
end;
$$;

revoke all on function private.site_employee(uuid) from public, anon;
revoke all on function private.holds_published_seat(uuid, date, uuid, smallint, uuid) from public, anon;
revoke all on function private.create_shift_trade(uuid, date, text, uuid, smallint, uuid, uuid, smallint) from public, anon;
revoke all on function private.answer_shift_trade(uuid, boolean) from public, anon;
revoke all on function private.cancel_shift_trade(uuid) from public, anon;
revoke all on function private.decide_shift_trade(uuid, boolean) from public, anon;
grant execute on function private.site_employee(uuid) to authenticated;
grant execute on function private.holds_published_seat(uuid, date, uuid, smallint, uuid) to authenticated;
grant execute on function private.create_shift_trade(uuid, date, text, uuid, smallint, uuid, uuid, smallint) to authenticated;
grant execute on function private.answer_shift_trade(uuid, boolean) to authenticated;
grant execute on function private.cancel_shift_trade(uuid) to authenticated;
grant execute on function private.decide_shift_trade(uuid, boolean) to authenticated;

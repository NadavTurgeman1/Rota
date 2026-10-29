-- Managers send a note to people at a site: everyone, named staff, or a shift.
-- Delivery is now, a later clock time, or the start of a chosen shift.
-- Employees only see a row after it is due. They acknowledge through a function.

create table public.manager_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  author_id uuid not null,
  author_name text not null default '',
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  audience text not null check (audience in ('all', 'people', 'shift')),
  deliver text not null check (deliver in ('now', 'at', 'shift_start')),
  due_at timestamptz not null,
  week_start date,
  shift_id uuid,
  weekday smallint check (weekday is null or weekday between 0 and 6),
  created_at timestamptz not null default now(),
  unique (id, org_id),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade,
  check (
    (
      audience <> 'shift'
      and deliver <> 'shift_start'
      and week_start is null
      and shift_id is null
      and weekday is null
    )
    or (
      week_start is not null
      and shift_id is not null
      and weekday is not null
    )
  )
);

comment on table public.manager_messages is
  'A manager note to staff at one site. Hidden from employees until due_at.';

create table public.manager_message_recipients (
  org_id uuid not null,
  site_id uuid not null,
  message_id uuid not null,
  employee_id uuid not null,
  read_at timestamptz,
  seen_popup_at timestamptz,
  primary key (message_id, employee_id),
  foreign key (message_id, org_id) references public.manager_messages (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

comment on table public.manager_message_recipients is
  'Who should see a manager note. Employees update acknowledgement only through a function.';

create index manager_messages_org_id_idx on public.manager_messages (org_id);
create index manager_messages_site_org_idx on public.manager_messages (site_id, org_id);
create index manager_messages_shift_org_idx on public.manager_messages (shift_id, org_id);
create index manager_messages_site_created_idx on public.manager_messages (site_id, created_at desc);
create index manager_messages_due_idx on public.manager_messages (due_at);
create index manager_message_recipients_org_id_idx on public.manager_message_recipients (org_id);
create index manager_message_recipients_site_org_idx on public.manager_message_recipients (site_id, org_id);
create index manager_message_recipients_employee_org_idx on public.manager_message_recipients (employee_id, org_id);
create index manager_message_recipients_message_org_idx on public.manager_message_recipients (message_id, org_id);

alter table public.manager_messages enable row level security;
alter table public.manager_messages force row level security;
alter table public.manager_message_recipients enable row level security;
alter table public.manager_message_recipients force row level security;

revoke all on table public.manager_messages from public, anon, authenticated;
revoke all on table public.manager_message_recipients from public, anon, authenticated;
grant select, insert, delete on table public.manager_messages to authenticated;
grant select, insert, delete on table public.manager_message_recipients to authenticated;

create policy manager_messages_manager on public.manager_messages
for all to authenticated
using ((select private.manages_site(site_id)))
with check ((select private.manages_site(site_id)));

create policy manager_messages_employee_read on public.manager_messages
for select to authenticated
using (
  due_at <= now()
  and exists (
    select 1
    from public.manager_message_recipients r
    where r.message_id = manager_messages.id
      and r.org_id = manager_messages.org_id
      and (select private.owns_employee(r.employee_id, r.org_id))
  )
);

create policy manager_message_recipients_manager on public.manager_message_recipients
for all to authenticated
using ((select private.manages_site(site_id)))
with check ((select private.manages_site(site_id)));

create policy manager_message_recipients_employee_read on public.manager_message_recipients
for select to authenticated
using ((select private.owns_employee(employee_id, org_id)));

create or replace function public.acknowledge_manager_message(target uuid, kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  if kind not in ('popup', 'read') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.manager_message_recipients r
  set
    seen_popup_at = case
      when kind = 'popup' then coalesce(r.seen_popup_at, now())
      else coalesce(r.seen_popup_at, now())
    end,
    read_at = case
      when kind = 'read' then coalesce(r.read_at, now())
      else r.read_at
    end
  where r.message_id = target
    and (select private.owns_employee(r.employee_id, r.org_id))
    and exists (
      select 1
      from public.manager_messages m
      where m.id = target
        and m.org_id = r.org_id
        and m.due_at <= now()
    );
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.acknowledge_manager_message(uuid, text) from public, anon;
grant execute on function public.acknowledge_manager_message(uuid, text) to authenticated;

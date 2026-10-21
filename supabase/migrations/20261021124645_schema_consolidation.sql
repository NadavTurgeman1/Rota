-- Consolidate the schema before wider rollout.
-- * One invitations table instead of three.
-- * Seat flags live on assignments instead of in two single-purpose tables.
-- * The home site is checked against the business by a foreign key, not a trigger.
-- * Every foreign key has a covering index; duplicate indexes are gone.
-- * RLS policies are evaluated once per query, with one policy per action.
-- * Views that nothing reads are dropped.

-- Views -----------------------------------------------------------------------

drop view public.businesses;
drop view public.tenants;
drop view public.site_users;
drop view public.site_employees;

-- Seat flags ------------------------------------------------------------------

alter table public.assignments
  add column locked boolean not null default false,
  add column over_quota boolean not null default false;

update public.assignments seat
set locked = true
from public.assignment_locks held
where held.schedule_id = seat.schedule_id
  and held.shift_id = seat.shift_id
  and held.weekday = seat.weekday
  and held.employee_id = seat.employee_id;

update public.assignments seat
set over_quota = true
from public.assignment_overages overage
where overage.schedule_id = seat.schedule_id
  and overage.shift_id = seat.shift_id
  and overage.weekday = seat.weekday
  and overage.employee_id = seat.employee_id;

drop table public.assignment_locks;
drop table public.assignment_overages;

comment on column public.assignments.locked is
  'Generating the week again keeps this seat while it still passes the rules.';
comment on column public.assignments.over_quota is
  'The manager approved this seat beyond the employee''s weekly agreement.';

-- Invitations -----------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null check (kind in ('manager', 'staff')),
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null default '',
  site_id uuid,
  employee_id uuid,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint invitations_site_fkey
    foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  constraint invitations_employee_fkey
    foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  constraint invitations_target check (
    (kind = 'manager' and site_id is not null and employee_id is null)
    or (kind = 'staff' and employee_id is not null and site_id is null)
  )
);

comment on table public.invitations is
  'Pending access to a business. manager: a shift manager for one site. staff: a login for one roster employee. Consumed when the person signs up.';

create index invitations_org_id_idx on public.invitations (org_id);
create index invitations_site_idx on public.invitations (site_id, org_id);
create index invitations_employee_idx on public.invitations (employee_id, org_id);
create index invitations_open_email_idx on public.invitations (email) where consumed_at is null;
create unique index invitations_open_manager_idx
  on public.invitations (site_id, email) where consumed_at is null and kind = 'manager';
create unique index invitations_open_staff_idx
  on public.invitations (employee_id) where consumed_at is null and kind = 'staff';
create unique index invitations_open_staff_email_idx
  on public.invitations (org_id, email) where consumed_at is null and kind = 'staff';

insert into public.invitations (id, org_id, kind, email, full_name, site_id, created_at, consumed_at)
select id, org_id, 'manager', email, coalesce(full_name, ''), site_id, created_at, consumed_at
from public.manager_invitations
where site_id is not null;

insert into public.invitations (id, org_id, kind, email, full_name, site_id, created_at, consumed_at)
select id, org_id, 'manager', email, coalesce(full_name, ''), site_id, created_at, consumed_at
from public.site_invitations
where role = 'manager'
on conflict do nothing;

insert into public.invitations (id, org_id, kind, email, employee_id, created_at, consumed_at)
select id, org_id, 'staff', email, employee_id, created_at, consumed_at
from public.staff_invitations;

alter table public.invitations enable row level security;
revoke all on table public.invitations from public, anon, authenticated;
grant select on table public.invitations to authenticated;

create policy invitations_read on public.invitations
for select to authenticated
using (
  (select private.org_role(org_id)) = 'owner'
  or (kind = 'manager' and email = (select private.actor_email()))
);

create or replace function private.signup_allowed(target_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admin_emails where email = lower(btrim(target_email))
  )
  or exists (
    select 1 from public.founder_approvals
    where email = lower(btrim(target_email)) and consumed_at is null
  )
  or exists (
    select 1 from public.invitations
    where email = lower(btrim(target_email)) and consumed_at is null
  );
$$;

create or replace function private.assign_shift_manager(
  target_org uuid,
  target_name text,
  target_email text,
  target_sites uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_email text := lower(btrim(target_email));
  target_site uuid;
  existing_user uuid;
begin
  if private.org_role(target_org) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(btrim(target_name)) = 0
     or cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or target_sites is null
     or cardinality(target_sites) = 0
  then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  if exists (
    select 1
    from unnest(target_sites) as requested (site_id)
    where not exists (
      select 1 from public.sites where id = requested.site_id and org_id = target_org
    )
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  select id into existing_user from auth.users where lower(email) = cleaned_email limit 1;
  foreach target_site in array target_sites loop
    if existing_user is not null then
      insert into public.memberships (org_id, user_id, role)
      values (target_org, existing_user, 'manager')
      on conflict (org_id, user_id) do nothing;
      insert into public.site_memberships (org_id, site_id, user_id, role)
      values (target_org, target_site, existing_user, 'manager')
      on conflict (site_id, user_id) do nothing;
      update public.invitations
      set consumed_at = now()
      where kind = 'manager'
        and org_id = target_org
        and email = cleaned_email
        and site_id = target_site
        and consumed_at is null;
    elsif not exists (
      select 1
      from public.invitations
      where kind = 'manager'
        and org_id = target_org
        and email = cleaned_email
        and site_id = target_site
        and consumed_at is null
    ) then
      insert into public.invitations (org_id, kind, site_id, email, full_name)
      values (target_org, 'manager', target_site, cleaned_email, btrim(target_name));
    end if;
  end loop;
  return true;
end;
$$;

create or replace function private.invite_shift_manager(
  target_org uuid,
  target_site uuid,
  target_name text,
  target_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assign_shift_manager(target_org, target_name, target_email, array[target_site]);
  return (
    select id
    from public.invitations
    where kind = 'manager'
      and org_id = target_org
      and site_id = target_site
      and email = lower(btrim(target_email))
    order by created_at desc
    limit 1
  );
end;
$$;

create or replace function private.set_shift_manager_sites(
  target_org uuid,
  target_email text,
  target_sites uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_email text := lower(btrim(target_email));
  manager_user uuid;
  invite_name text;
begin
  if private.org_role(target_org) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if target_sites is null
     or cardinality(target_sites) = 0
     or exists (
       select 1
       from unnest(target_sites) as requested (site_id)
       where not exists (
         select 1 from public.sites where id = requested.site_id and org_id = target_org
       )
     )
  then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  select membership.user_id into manager_user
  from public.memberships membership
  join auth.users account on account.id = membership.user_id
  where membership.org_id = target_org
    and membership.role = 'manager'
    and lower(account.email) = cleaned_email
  limit 1;

  if manager_user is not null then
    delete from public.site_memberships
    where org_id = target_org and user_id = manager_user and not (site_id = any (target_sites));
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select target_org, requested.site_id, manager_user, 'manager'
    from unnest(target_sites) as requested (site_id)
    on conflict (site_id, user_id) do nothing;
    return true;
  end if;

  select full_name into invite_name
  from public.invitations
  where kind = 'manager' and org_id = target_org and email = cleaned_email and consumed_at is null
  order by created_at
  limit 1;
  if invite_name is null then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  delete from public.invitations
  where kind = 'manager'
    and org_id = target_org
    and email = cleaned_email
    and consumed_at is null
    and not (site_id = any (target_sites));
  insert into public.invitations (org_id, kind, site_id, email, full_name)
  select target_org, 'manager', requested.site_id, cleaned_email, invite_name
  from unnest(target_sites) as requested (site_id)
  where not exists (
    select 1
    from public.invitations open_invite
    where open_invite.kind = 'manager'
      and open_invite.org_id = target_org
      and open_invite.email = cleaned_email
      and open_invite.site_id = requested.site_id
      and open_invite.consumed_at is null
  );
  return true;
end;
$$;

create or replace function private.remove_shift_manager(target_org uuid, target_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_email text := lower(btrim(target_email));
  manager_user uuid;
begin
  if private.org_role(target_org) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select membership.user_id into manager_user
  from public.memberships membership
  join auth.users account on account.id = membership.user_id
  where membership.org_id = target_org
    and membership.role = 'manager'
    and lower(account.email) = cleaned_email
  limit 1;

  delete from public.invitations
  where kind = 'manager' and org_id = target_org and email = cleaned_email and consumed_at is null;
  if manager_user is null then
    return true;
  end if;
  delete from public.site_memberships where org_id = target_org and user_id = manager_user;
  delete from public.memberships where org_id = target_org and user_id = manager_user and role = 'manager';
  perform private.drop_login_if_unused(manager_user);
  return true;
end;
$$;

create or replace function private.assign_staff_login(
  target_org uuid,
  target_employee uuid,
  target_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned_email text := lower(btrim(target_email));
  existing_user uuid;
begin
  if not private.is_manager(target_org) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or not exists (
       select 1 from public.employees where id = target_employee and org_id = target_org
     )
     or not exists (
       select 1 from public.employee_sites where employee_id = target_employee and org_id = target_org
     )
  then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.employees
    where id = target_employee and org_id = target_org and user_id is not null
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.founder_approvals
    where email = cleaned_email and consumed_at is null
  ) or exists (
    select 1 from public.invitations
    where email = cleaned_email
      and consumed_at is null
      and (kind <> 'staff' or employee_id <> target_employee)
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  select id into existing_user from auth.users where lower(email) = cleaned_email limit 1;
  if existing_user is not null then
    if exists (
      select 1 from public.memberships
      where org_id = target_org and user_id = existing_user and role <> 'employee'
    ) or exists (
      select 1 from public.employees
      where org_id = target_org and user_id = existing_user and id <> target_employee
    ) then
      raise exception 'invitation is invalid' using errcode = '23514';
    end if;
    insert into public.memberships (org_id, user_id, role)
    values (target_org, existing_user, 'employee')
    on conflict (org_id, user_id) do nothing;
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select es.org_id, es.site_id, existing_user, 'employee'
    from public.employee_sites es
    where es.employee_id = target_employee and es.org_id = target_org
    on conflict (site_id, user_id) do nothing;
    update public.employees
    set user_id = existing_user
    where id = target_employee and org_id = target_org and user_id is null;
    update public.invitations
    set consumed_at = now()
    where kind = 'staff' and org_id = target_org and employee_id = target_employee and consumed_at is null;
    return 'linked';
  end if;

  delete from public.invitations
  where kind = 'staff' and org_id = target_org and employee_id = target_employee and consumed_at is null;
  insert into public.invitations (org_id, kind, employee_id, email)
  values (target_org, 'staff', target_employee, cleaned_email);
  return 'invited';
end;
$$;

create or replace function private.remove_staff_login(target_org uuid, target_employee uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_user uuid;
begin
  if not private.is_manager(target_org) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employees where id = target_employee and org_id = target_org) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  select user_id into linked_user
  from public.employees
  where id = target_employee and org_id = target_org;

  delete from public.invitations
  where kind = 'staff' and org_id = target_org and employee_id = target_employee;
  if linked_user is null then
    return true;
  end if;
  update public.employees set user_id = null where id = target_employee and org_id = target_org;
  if not exists (select 1 from public.employees where org_id = target_org and user_id = linked_user) then
    delete from public.site_memberships where org_id = target_org and user_id = linked_user and role = 'employee';
    delete from public.memberships where org_id = target_org and user_id = linked_user and role = 'employee';
  end if;
  perform private.drop_login_if_unused(linked_user);
  return true;
end;
$$;

create or replace function private.attach_invited_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  approval public.founder_approvals%rowtype;
  invite public.invitations%rowtype;
  attached boolean := false;
begin
  select * into approval
  from public.founder_approvals
  where email = lower(new.email) and consumed_at is null and organization_id is not null
  order by created_at
  limit 1
  for update;
  if approval.id is not null then
    insert into public.memberships (org_id, user_id, role)
    values (approval.organization_id, new.id, 'owner')
    on conflict (org_id, user_id) do nothing;
    update public.profiles
    set name = coalesce(nullif(btrim(name), ''), approval.full_name)
    where user_id = new.id;
    update public.founder_approvals set consumed_at = now() where id = approval.id;
    return new;
  end if;

  for invite in
    select *
    from public.invitations
    where kind = 'manager' and email = lower(new.email) and consumed_at is null
    order by created_at
    for update
  loop
    attached := true;
    insert into public.memberships (org_id, user_id, role)
    values (invite.org_id, new.id, 'manager')
    on conflict (org_id, user_id) do nothing;
    insert into public.site_memberships (org_id, site_id, user_id, role)
    values (invite.org_id, invite.site_id, new.id, 'manager')
    on conflict (site_id, user_id) do nothing;
    update public.profiles
    set name = coalesce(nullif(btrim(name), ''), nullif(invite.full_name, ''))
    where user_id = new.id;
    update public.invitations set consumed_at = now() where id = invite.id;
  end loop;
  if attached then
    return new;
  end if;

  for invite in
    select *
    from public.invitations
    where kind = 'staff' and email = lower(new.email) and consumed_at is null
    order by created_at
    for update
  loop
    if exists (
      select 1
      from public.memberships
      where org_id = invite.org_id and user_id = new.id and role <> 'employee'
    ) then
      continue;
    end if;
    insert into public.memberships (org_id, user_id, role)
    values (invite.org_id, new.id, 'employee')
    on conflict (org_id, user_id) do nothing;
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select es.org_id, es.site_id, new.id, 'employee'
    from public.employee_sites es
    where es.employee_id = invite.employee_id and es.org_id = invite.org_id
    on conflict (site_id, user_id) do nothing;
    update public.employees
    set user_id = new.id
    where id = invite.employee_id and org_id = invite.org_id and user_id is null;
    update public.profiles
    set name = coalesce(
      nullif(btrim(name), ''),
      (select e.name from public.employees e where e.id = invite.employee_id)
    )
    where user_id = new.id;
    update public.invitations set consumed_at = now() where id = invite.id;
  end loop;
  return new;
end;
$$;

drop function public.invite_site_user(uuid, text, text, text);
drop function private.invite_site_user(uuid, text, text, text);

drop table public.manager_invitations;
drop table public.staff_invitations;
drop table public.site_invitations;

-- Employees -------------------------------------------------------------------

alter table public.employees rename column contact to email;
comment on column public.employees.email is
  'Contact email the manager keeps on the roster. The login email lives in profiles.';

drop trigger employees_home_site_same_org on public.employees;
drop function private.employee_home_site_same_org();
alter table public.employees drop constraint employees_home_site_id_fkey;
alter table public.employees
  add constraint employees_home_site_fkey
  foreign key (home_site_id, org_id) references public.sites (id, org_id)
  on delete set null (home_site_id);

-- Indexes ---------------------------------------------------------------------

drop index public.employees_org_user_idx;

drop index public.assignments_employee_id_idx;
drop index public.assignment_extensions_cover_shift_id_idx;
drop index public.availability_entries_shift_id_idx;
drop index public.availability_requests_site_idx;
drop index public.constraint_notes_site_week_idx;
drop index public.employee_agreements_shift_id_idx;
drop index public.employee_preferences_shift_id_idx;
drop index public.employee_qualifications_qualification_id_idx;
drop index public.employee_sites_site_id_idx;
drop index public.schedule_calloffs_schedule_id_idx;
drop index public.shift_trades_site_idx;
drop index public.shifts_site_id_idx;

create index shifts_site_idx on public.shifts (site_id, org_id);
create index shift_requirements_shift_idx on public.shift_requirements (shift_id, org_id);
create index employees_home_site_idx on public.employees (home_site_id, org_id);
create index employee_sites_employee_idx on public.employee_sites (employee_id, org_id);
create index employee_sites_site_idx on public.employee_sites (site_id, org_id);
create index employee_agreements_employee_idx on public.employee_agreements (employee_id, org_id);
create index employee_agreements_shift_idx on public.employee_agreements (shift_id, org_id);
create index employee_preferences_employee_idx on public.employee_preferences (employee_id, org_id);
create index employee_preferences_shift_idx on public.employee_preferences (shift_id, org_id);
create index employee_qualifications_employee_idx on public.employee_qualifications (employee_id, org_id);
create index employee_qualifications_qualification_idx on public.employee_qualifications (qualification_id, org_id);
create index availability_weeks_site_idx on public.availability_weeks (site_id, org_id);
create index availability_weeks_employee_idx on public.availability_weeks (employee_id, org_id);
create index availability_entries_week_idx on public.availability_entries (availability_week_id, org_id);
create index availability_entries_shift_idx on public.availability_entries (shift_id, org_id);
create index availability_requests_site_idx on public.availability_requests (site_id, org_id, status);
create index availability_requests_employee_idx on public.availability_requests (employee_id, org_id);
create index constraint_notes_site_idx on public.constraint_notes (site_id, org_id, week_start);
create index schedules_site_idx on public.schedules (site_id, org_id);
create index assignments_schedule_idx on public.assignments (schedule_id, org_id);
create index assignments_shift_idx on public.assignments (shift_id, org_id);
create index assignments_employee_idx on public.assignments (employee_id, org_id);
create index assignment_extensions_schedule_idx on public.assignment_extensions (schedule_id, org_id);
create index assignment_extensions_cover_idx on public.assignment_extensions (cover_shift_id, org_id);
create index schedule_calloffs_schedule_idx on public.schedule_calloffs (schedule_id, org_id);
create index schedule_calloffs_shift_idx on public.schedule_calloffs (shift_id, org_id);
create index schedule_calloffs_employee_idx on public.schedule_calloffs (employee_id, org_id);
create index schedule_versions_schedule_idx on public.schedule_versions (schedule_id, org_id);
create index shift_trades_site_idx on public.shift_trades (site_id, org_id, status);
create index shift_trades_requester_idx on public.shift_trades (requester_id, org_id);
create index shift_trades_target_idx on public.shift_trades (target_id, org_id);
create index shift_trades_offered_shift_idx on public.shift_trades (offered_shift_id, org_id);
create index shift_trades_target_shift_idx on public.shift_trades (target_shift_id, org_id);
create index site_memberships_site_idx on public.site_memberships (site_id, org_id);
create index founder_approvals_organization_idx on public.founder_approvals (organization_id);

-- Policies --------------------------------------------------------------------

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.user_id
  )
  or (
    (select private.is_platform_admin())
    and exists (
      select 1
      from public.memberships member
      where member.user_id = profiles.user_id
        and member.org_id::text = (select nullif(current_setting('app.support_org', true), ''))
    )
  )
);

drop policy availability_weeks_write on public.availability_weeks;
create policy availability_weeks_insert on public.availability_weeks
for insert to authenticated
with check ((select private.is_manager(org_id)));
create policy availability_weeks_update on public.availability_weeks
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));
create policy availability_weeks_delete on public.availability_weeks
for delete to authenticated
using ((select private.is_manager(org_id)));

drop policy availability_entries_write on public.availability_entries;
create policy availability_entries_insert on public.availability_entries
for insert to authenticated
with check ((select private.is_manager(org_id)));
create policy availability_entries_update on public.availability_entries
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));
create policy availability_entries_delete on public.availability_entries
for delete to authenticated
using ((select private.is_manager(org_id)));

-- Documentation ---------------------------------------------------------------

comment on table public.organizations is 'A business: the tenant. Every other business table carries org_id.';
comment on table public.sites is 'A place the business schedules separately, with its own shifts and rules.';
comment on table public.employees is 'A person on the business roster. user_id is set once they have a login.';
comment on table public.memberships is 'A login''s role in a business: owner, manager or employee.';
comment on table public.site_memberships is 'Which sites a manager or employee login can open.';
comment on table public.schedules is 'One week of one site, as a draft or published.';
comment on table public.assignments is 'One employee seated in one shift on one weekday of a schedule.';
comment on table public.assignment_extensions is
  'A seat stretched to cover part of another shift. Deleting the covered shift removes only the extension.';
comment on table public.founder_approvals is
  'Platform-level approval for someone to open or own a business. Not tied to a tenant until provisioned.';

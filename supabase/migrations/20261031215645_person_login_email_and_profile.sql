alter table public.employees add column if not exists profile jsonb not null default '{}'::jsonb;

update public.employees e
set profile = ep.profile
from public.employee_profiles ep
where ep.employee_id = e.id
  and ep.profile is not null
  and ep.profile <> '{}'::jsonb;

comment on column public.employees.profile is
  'Identity, address, employment and bank details. authenticated cannot select this column. private.employee_form returns it to a manager.';

comment on column public.employees.email is
  'The sign-in email for this person. Empty means no login. When user_id is set, this is also auth.users.email.';

revoke select (profile) on public.employees from public, anon, authenticated;

create or replace function private.employee_form(target_employee uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  org uuid;
  stored jsonb;
begin
  select org_id, profile into org, stored from public.employees where id = target_employee;
  if org is null then
    return null;
  end if;
  if actor is null or private.org_role(org) = 'owner' or private.is_manager(org) then
    return stored;
  end if;
  return null;
end;
$$;

revoke all on function private.employee_form(uuid) from public, anon;
grant execute on function private.employee_form(uuid) to authenticated;

drop table if exists public.employee_profiles;

update public.employees e
set email = lower(i.email)
from public.invitations i
where i.kind = 'staff'
  and i.consumed_at is null
  and i.employee_id = e.id
  and i.email <> '';

update public.employees e
set email = lower(p.email)
from public.profiles p
where e.user_id = p.user_id
  and p.email <> '';

insert into public.employees (org_id, name, email, schedulable, capabilities)
select distinct on (i.org_id, i.email)
  i.org_id,
  coalesce(nullif(btrim(i.full_name), ''), nullif(split_part(i.email, '@', 1), ''), 'Manager'),
  i.email,
  false,
  '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":true,"site_settings":true,"people_site":true,"people_edit":true,"messages":true,"insights":true,"documents":true}'::jsonb
from public.invitations i
where i.kind = 'manager'
  and i.consumed_at is null
  and i.email <> ''
  and not exists (
    select 1 from public.employees e
    where e.org_id = i.org_id and lower(e.email) = i.email
  )
order by i.org_id, i.email, i.created_at;

insert into public.employee_managed_sites (org_id, employee_id, site_id)
select i.org_id, e.id, i.site_id
from public.invitations i
join public.employees e on e.org_id = i.org_id and lower(e.email) = i.email
where i.kind = 'manager'
  and i.consumed_at is null
  and i.site_id is not null
on conflict do nothing;

create or replace function private.sync_account_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null or new.email = '' then
    return new;
  end if;
  new.email := lower(btrim(new.email));
  if tg_op = 'UPDATE'
     and new.email is not distinct from old.email
     and new.user_id is not distinct from old.user_id
  then
    return new;
  end if;
  if exists (
    select 1 from auth.users
    where id <> new.user_id and lower(email) = new.email
  ) then
    raise exception 'invitation is invalid' using errcode = '23505';
  end if;
  update auth.users set email = new.email where id = new.user_id and lower(email) is distinct from new.email;
  update public.profiles set email = new.email where user_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists employees_sync_account_email on public.employees;
create trigger employees_sync_account_email
before update of email, user_id on public.employees
for each row execute function private.sync_account_email();

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
    select 1 from public.employees
    where lower(email) = lower(btrim(target_email))
      and email <> ''
      and user_id is null
  );
$$;

create or replace function private.attach_invited_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  approval public.founder_approvals%rowtype;
  person public.employees%rowtype;
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

  for person in
    select *
    from public.employees
    where lower(email) = lower(new.email) and email <> '' and user_id is null
    order by created_at
    for update
  loop
    if exists (
      select 1 from public.memberships
      where org_id = person.org_id and user_id = new.id and role = 'owner'
    ) then
      continue;
    end if;
    if private.employee_is_lead(person.id) then
      insert into public.memberships (org_id, user_id, role)
      values (person.org_id, new.id, 'manager')
      on conflict (org_id, user_id) do nothing;
      insert into public.site_memberships (org_id, site_id, user_id, role)
      select person.org_id, es.site_id, new.id, 'manager'
      from public.employee_sites es
      where es.employee_id = person.id
      on conflict (site_id, user_id) do update set role = 'manager';
      insert into public.site_memberships (org_id, site_id, user_id, role)
      select person.org_id, ms.site_id, new.id, 'manager'
      from public.employee_managed_sites ms
      where ms.employee_id = person.id
      on conflict (site_id, user_id) do update set role = 'manager';
    else
      insert into public.memberships (org_id, user_id, role)
      values (person.org_id, new.id, 'employee')
      on conflict (org_id, user_id) do nothing;
      insert into public.site_memberships (org_id, site_id, user_id, role)
      select es.org_id, es.site_id, new.id, 'employee'
      from public.employee_sites es
      where es.employee_id = person.id and es.org_id = person.org_id
      on conflict (site_id, user_id) do nothing;
    end if;
    update public.employees set user_id = new.id where id = person.id and user_id is null;
    update public.profiles
    set name = coalesce(nullif(btrim(name), ''), person.name)
    where user_id = new.id;
  end loop;
  return new;
end;
$$;

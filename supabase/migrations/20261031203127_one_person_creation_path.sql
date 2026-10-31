-- One path creates a person, their place in the tree, their sites, and their login.
-- Capabilities stay on employees.capabilities. The duplicate permissions table goes away.

drop trigger if exists employees_sync_permissions on public.employees;
drop function if exists private.sync_employee_permissions();
drop table if exists public.employee_permissions;

insert into public.employees (org_id, user_id, name, email, schedulable, capabilities)
select m.org_id,
       m.user_id,
       coalesce(nullif(btrim(p.name), ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Owner'),
       coalesce(u.email, ''),
       false,
       '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":true,"site_settings":true,"people_site":true,"people_edit":true,"messages":true,"insights":true,"documents":true}'::jsonb
from public.memberships m
join auth.users u on u.id = m.user_id
left join public.profiles p on p.user_id = m.user_id
where m.role = 'owner'
  and not exists (
    select 1 from public.employees e
    where e.org_id = m.org_id and e.user_id = m.user_id
  );

create or replace function private.create_organization(org_name text, org_slug text, org_kind text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_email text;
  approval_id uuid;
  new_id uuid;
  owner_name text;
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if btrim(org_name) = '' then
    raise exception 'organization name is required' using errcode = '23514';
  end if;
  select lower(email) into actor_email from auth.users where id = actor;
  select id into approval_id
  from public.founder_approvals
  where email = actor_email and consumed_at is null and organization_id is null
  order by created_at
  limit 1
  for update;
  if approval_id is null then
    raise exception 'organization is not approved' using errcode = '42501';
  end if;
  insert into public.organizations (name, slug, kind, status)
  values (btrim(org_name), org_slug, coalesce(org_kind, ''), 'active')
  returning id into new_id;
  insert into public.memberships (org_id, user_id, role)
  values (new_id, actor, 'owner');
  select coalesce(nullif(btrim(name), ''), nullif(split_part(coalesce(actor_email, ''), '@', 1), ''), 'Owner')
    into owner_name
  from public.profiles
  where user_id = actor;
  if owner_name is null then
    owner_name := coalesce(nullif(split_part(coalesce(actor_email, ''), '@', 1), ''), 'Owner');
  end if;
  insert into public.employees (org_id, user_id, name, email, schedulable, capabilities)
  values (
    new_id,
    actor,
    owner_name,
    coalesce(actor_email, ''),
    false,
    '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":true,"site_settings":true,"people_site":true,"people_edit":true,"messages":true,"insights":true,"documents":true}'::jsonb
  );
  update public.founder_approvals
  set consumed_at = now(), organization_id = new_id
  where id = approval_id;
  return new_id;
end;
$$;

create or replace function private.sync_login_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.memberships
    where org_id = new.org_id and user_id = new.user_id and role = 'owner'
  ) then
    return new;
  end if;
  if private.employee_is_lead(new.id) then
    update public.memberships
    set role = 'manager'
    where org_id = new.org_id and user_id = new.user_id and role = 'employee';
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select new.org_id, es.site_id, new.user_id, 'manager'
    from public.employee_sites es
    where es.employee_id = new.id
    on conflict (site_id, user_id) do update set role = 'manager';
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select new.org_id, ms.site_id, new.user_id, 'manager'
    from public.employee_managed_sites ms
    where ms.employee_id = new.id
    on conflict (site_id, user_id) do update set role = 'manager';
  else
    update public.memberships
    set role = 'employee'
    where org_id = new.org_id and user_id = new.user_id and role = 'manager';
    update public.site_memberships
    set role = 'employee'
    where org_id = new.org_id and user_id = new.user_id and role = 'manager';
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select new.org_id, es.site_id, new.user_id, 'employee'
    from public.employee_sites es
    where es.employee_id = new.id
    on conflict (site_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.open_person(
  target_org uuid,
  person_id uuid,
  person_name text,
  person_phone text,
  person_email text,
  person_schedulable boolean,
  person_capabilities jsonb,
  work_site uuid,
  managed_sites uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  actor_employee uuid;
  cleaned_name text := btrim(person_name);
  cleaned_email text := lower(btrim(coalesce(person_email, '')));
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if private.org_role(target_org) is null
     or (
       private.org_role(target_org) <> 'owner'
       and not private.is_manager(target_org)
       and not private.has_capability(target_org, 'people_edit')
     )
  then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if person_id is null or cleaned_name = '' then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  if private.org_role(target_org) = 'owner' and private.actor_employee(target_org) is null then
    insert into public.employees (org_id, user_id, name, email, schedulable, capabilities)
    values (
      target_org,
      actor,
      coalesce((select nullif(btrim(name), '') from public.profiles where user_id = actor), nullif(split_part(coalesce((select email from auth.users where id = actor), ''), '@', 1), ''), 'Owner'),
      coalesce((select email from auth.users where id = actor), ''),
      false,
      '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":true,"site_settings":true,"people_site":true,"people_edit":true,"messages":true,"insights":true,"documents":true}'::jsonb
    );
  end if;
  actor_employee := private.actor_employee(target_org);
  if actor_employee is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if person_schedulable and (work_site is null or not exists (select 1 from public.sites where id = work_site and org_id = target_org)) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  if managed_sites is not null and exists (
    select 1 from unnest(managed_sites) as requested(site_id)
    where not exists (select 1 from public.sites where id = requested.site_id and org_id = target_org)
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  insert into public.employees (
    id, org_id, name, email, phone, schedulable, capabilities, reports_to, opened_by, home_site_id
  )
  values (
    person_id,
    target_org,
    cleaned_name,
    cleaned_email,
    coalesce(person_phone, ''),
    person_schedulable,
    coalesce(person_capabilities, '{}'::jsonb),
    case when actor_employee = person_id then null else actor_employee end,
    case when actor_employee = person_id then null else actor_employee end,
    case when person_schedulable then work_site else null end
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    schedulable = excluded.schedulable,
    capabilities = excluded.capabilities,
    reports_to = coalesce(public.employees.reports_to, excluded.reports_to),
    opened_by = coalesce(public.employees.opened_by, excluded.opened_by),
    home_site_id = coalesce(public.employees.home_site_id, excluded.home_site_id)
  where public.employees.org_id = excluded.org_id;

  if person_schedulable then
    insert into public.employee_sites (org_id, employee_id, site_id)
    values (target_org, person_id, work_site)
    on conflict do nothing;
  end if;
  if managed_sites is not null then
    insert into public.employee_managed_sites (org_id, employee_id, site_id)
    select target_org, person_id, requested.site_id
    from unnest(managed_sites) as requested(site_id)
    on conflict do nothing;
  end if;

  if cleaned_email = '' then
    return 'saved';
  end if;
  return private.assign_staff_login(target_org, person_id, cleaned_email);
end;
$$;

create or replace function public.open_person(
  target_org uuid,
  person_id uuid,
  person_name text,
  person_phone text,
  person_email text,
  person_schedulable boolean,
  person_capabilities text,
  work_site uuid,
  managed_sites uuid[]
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.open_person(
    target_org,
    person_id,
    person_name,
    person_phone,
    person_email,
    person_schedulable,
    person_capabilities::jsonb,
    work_site,
    managed_sites
  );
$$;

revoke all on function private.open_person(uuid, uuid, text, text, text, boolean, jsonb, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.open_person(uuid, uuid, text, text, text, boolean, text, uuid, uuid[]) from public, anon;
grant execute on function public.open_person(uuid, uuid, text, text, text, boolean, text, uuid, uuid[]) to authenticated;

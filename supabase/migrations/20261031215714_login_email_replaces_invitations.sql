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
  if not private.is_manager(target_org) and not private.has_capability(target_org, 'people_edit') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if cleaned_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or not exists (
       select 1 from public.employees where id = target_employee and org_id = target_org
     )
     or not (
       exists (select 1 from public.employee_sites where employee_id = target_employee and org_id = target_org)
       or exists (select 1 from public.employee_managed_sites where employee_id = target_employee and org_id = target_org)
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
    select 1 from public.employees
    where org_id = target_org and id <> target_employee and lower(email) = cleaned_email and email <> ''
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  select id into existing_user from auth.users where lower(email) = cleaned_email limit 1;
  if existing_user is not null then
    if exists (
      select 1 from public.memberships
      where org_id = target_org and user_id = existing_user and role = 'owner'
    ) or exists (
      select 1 from public.employees
      where org_id = target_org and user_id = existing_user and id <> target_employee
    ) then
      raise exception 'invitation is invalid' using errcode = '23514';
    end if;
    insert into public.memberships (org_id, user_id, role)
    values (target_org, existing_user, 'employee')
    on conflict (org_id, user_id) do nothing;
    update public.employees
    set user_id = existing_user, email = cleaned_email
    where id = target_employee and org_id = target_org and user_id is null;
    return 'linked';
  end if;

  update public.employees
  set email = cleaned_email
  where id = target_employee and org_id = target_org;
  return 'invited';
end;
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
  existing_user uuid;
  person_id uuid;
begin
  if private.org_role(target_org) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if length(btrim(target_name)) = 0
     or cleaned_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or target_sites is null
     or cardinality(target_sites) = 0
  then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(target_sites) as requested (site_id)
    where not exists (select 1 from public.sites where id = requested.site_id and org_id = target_org)
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  select id into existing_user from auth.users where lower(email) = cleaned_email limit 1;
  if existing_user is not null then
    insert into public.memberships (org_id, user_id, role)
    values (target_org, existing_user, 'manager')
    on conflict (org_id, user_id) do nothing;
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select target_org, requested.site_id, existing_user, 'manager'
    from unnest(target_sites) as requested (site_id)
    on conflict (site_id, user_id) do nothing;
    return true;
  end if;

  select id into person_id
  from public.employees
  where org_id = target_org and lower(email) = cleaned_email
  limit 1;
  if person_id is null then
    insert into public.employees (org_id, name, email, schedulable, capabilities)
    values (
      target_org,
      btrim(target_name),
      cleaned_email,
      false,
      '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":true,"site_settings":true,"people_site":true,"people_edit":true,"messages":true,"insights":true,"documents":true}'::jsonb
    )
    returning id into person_id;
  end if;
  insert into public.employee_managed_sites (org_id, employee_id, site_id)
  select target_org, person_id, requested.site_id
  from unnest(target_sites) as requested (site_id)
  on conflict do nothing;
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
    select id from public.employees
    where org_id = target_org and lower(email) = lower(btrim(target_email))
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
  person_id uuid;
begin
  if private.org_role(target_org) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if target_sites is null
     or cardinality(target_sites) = 0
     or exists (
       select 1 from unnest(target_sites) as requested (site_id)
       where not exists (select 1 from public.sites where id = requested.site_id and org_id = target_org)
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

  select id into person_id
  from public.employees
  where org_id = target_org and lower(email) = cleaned_email and user_id is null
  limit 1;
  if person_id is null then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  delete from public.employee_managed_sites
  where employee_id = person_id and not (site_id = any (target_sites));
  insert into public.employee_managed_sites (org_id, employee_id, site_id)
  select target_org, person_id, requested.site_id
  from unnest(target_sites) as requested (site_id)
  on conflict do nothing;
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

  if manager_user is null then
    return true;
  end if;
  delete from public.site_memberships where org_id = target_org and user_id = manager_user;
  delete from public.memberships where org_id = target_org and user_id = manager_user and role = 'manager';
  perform private.drop_login_if_unused(manager_user);
  return true;
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

drop table if exists public.invitations;

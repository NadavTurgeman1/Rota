-- The owner changes a shift manager's sites or removes the shift manager.
-- An owner or shift manager removes an employee login. The roster person stays.
-- A login left with no membership and no roster link is deleted from auth.users.

create or replace function private.drop_login_if_unused(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user is null then
    return;
  end if;
  if exists (select 1 from public.memberships where user_id = target_user)
     or exists (select 1 from public.employees where user_id = target_user)
     or exists (
       select 1
       from public.platform_admin_emails admin
       join auth.users account on lower(account.email) = admin.email
       where account.id = target_user
     )
  then
    return;
  end if;
  delete from auth.users where id = target_user;
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
  from public.manager_invitations
  where org_id = target_org and email = cleaned_email and consumed_at is null
  order by created_at
  limit 1;
  if invite_name is null then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  delete from public.manager_invitations
  where org_id = target_org
    and email = cleaned_email
    and consumed_at is null
    and not (site_id = any (target_sites));
  insert into public.manager_invitations (org_id, site_id, email, full_name)
  select target_org, requested.site_id, cleaned_email, invite_name
  from unnest(target_sites) as requested (site_id)
  where not exists (
    select 1
    from public.manager_invitations open_invite
    where open_invite.org_id = target_org
      and open_invite.email = cleaned_email
      and open_invite.site_id = requested.site_id
      and open_invite.consumed_at is null
  );
  return true;
end;
$$;

create or replace function public.set_shift_manager_sites(target_org uuid, target_email text, target_sites uuid[])
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.set_shift_manager_sites(target_org, target_email, target_sites);
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

  delete from public.manager_invitations
  where org_id = target_org and email = cleaned_email and consumed_at is null;
  if manager_user is null then
    return true;
  end if;
  delete from public.site_memberships where org_id = target_org and user_id = manager_user;
  delete from public.memberships where org_id = target_org and user_id = manager_user and role = 'manager';
  perform private.drop_login_if_unused(manager_user);
  return true;
end;
$$;

create or replace function public.remove_shift_manager(target_org uuid, target_email text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.remove_shift_manager(target_org, target_email);
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

  delete from public.staff_invitations where org_id = target_org and employee_id = target_employee;
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

create or replace function public.remove_staff_login(target_org uuid, target_employee uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.remove_staff_login(target_org, target_employee);
$$;

revoke all on function private.drop_login_if_unused(uuid) from public, anon, authenticated;
revoke all on function private.set_shift_manager_sites(uuid, text, uuid[]) from public, anon;
revoke all on function public.set_shift_manager_sites(uuid, text, uuid[]) from public, anon;
revoke all on function private.remove_shift_manager(uuid, text) from public, anon;
revoke all on function public.remove_shift_manager(uuid, text) from public, anon;
revoke all on function private.remove_staff_login(uuid, uuid) from public, anon;
revoke all on function public.remove_staff_login(uuid, uuid) from public, anon;

grant execute on function private.set_shift_manager_sites(uuid, text, uuid[]) to authenticated;
grant execute on function public.set_shift_manager_sites(uuid, text, uuid[]) to authenticated;
grant execute on function private.remove_shift_manager(uuid, text) to authenticated;
grant execute on function public.remove_shift_manager(uuid, text) to authenticated;
grant execute on function private.remove_staff_login(uuid, uuid) to authenticated;
grant execute on function public.remove_staff_login(uuid, uuid) to authenticated;

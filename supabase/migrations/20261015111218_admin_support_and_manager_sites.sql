-- A platform admin can open one existing business as its company admin, for support.
-- A shift manager can be assigned any number of sites, before or after sign-up.

drop index if exists public.manager_invitations_open_email_idx;

create unique index manager_invitations_open_site_idx
  on public.manager_invitations (email, site_id)
  where consumed_at is null;

comment on table public.manager_invitations is 'Shift managers a company admin allowed to join one or more sites.';

create or replace function private.org_role(target_org uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  support_org text := nullif(current_setting('app.support_org', true), '');
begin
  if support_org is not null
     and support_org = target_org::text
     and private.is_platform_admin() then
    return 'owner';
  end if;
  return (
    select membership.role
    from public.memberships membership
    join public.organizations tenant on tenant.id = membership.org_id
    where membership.org_id = target_org
      and membership.user_id = (select auth.uid())
      and tenant.status = 'active'
  );
end;
$$;

create or replace function private.support_membership()
returns table (org_id uuid, org_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select tenant.id, tenant.name, 'owner'::text
  from public.organizations tenant
  where private.is_platform_admin()
    and tenant.id::text = nullif(current_setting('app.support_org', true), '');
$$;

create or replace function private.attach_invited_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  approval public.founder_approvals%rowtype;
  manager public.manager_invitations%rowtype;
  invite public.site_invitations%rowtype;
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

  for manager in
    select *
    from public.manager_invitations
    where email = lower(new.email) and consumed_at is null
    order by created_at
    for update
  loop
    attached := true;
    insert into public.memberships (org_id, user_id, role)
    values (manager.org_id, new.id, 'manager')
    on conflict (org_id, user_id) do nothing;
    if manager.site_id is not null then
      insert into public.site_memberships (org_id, site_id, user_id, role)
      values (manager.org_id, manager.site_id, new.id, 'manager')
      on conflict (site_id, user_id) do nothing;
    end if;
    update public.profiles
    set name = coalesce(nullif(btrim(name), ''), manager.full_name)
    where user_id = new.id;
    update public.manager_invitations set consumed_at = now() where id = manager.id;
  end loop;
  if attached then
    return new;
  end if;

  select * into invite
  from public.site_invitations
  where email = lower(new.email) and consumed_at is null
  order by created_at
  limit 1
  for update;
  if invite.id is null then
    return new;
  end if;
  insert into public.memberships (org_id, user_id, role)
  values (invite.org_id, new.id, invite.role)
  on conflict (org_id, user_id) do nothing;
  insert into public.site_memberships (org_id, site_id, user_id, role)
  values (invite.org_id, invite.site_id, new.id, invite.role)
  on conflict (site_id, user_id) do nothing;
  update public.profiles
  set name = coalesce(nullif(btrim(name), ''), invite.full_name)
  where user_id = new.id;
  update public.site_invitations set consumed_at = now() where id = invite.id;
  return new;
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
      update public.manager_invitations
      set consumed_at = now()
      where org_id = target_org and email = cleaned_email and site_id = target_site and consumed_at is null;
    elsif not exists (
      select 1
      from public.manager_invitations
      where org_id = target_org and email = cleaned_email and site_id = target_site and consumed_at is null
    ) then
      insert into public.manager_invitations (org_id, site_id, email, full_name)
      values (target_org, target_site, cleaned_email, btrim(target_name));
    end if;
  end loop;
  return true;
end;
$$;

create or replace function public.assign_shift_manager(
  target_org uuid,
  target_name text,
  target_email text,
  target_sites uuid[]
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.assign_shift_manager(target_org, target_name, target_email, target_sites);
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
    from public.manager_invitations
    where org_id = target_org and site_id = target_site and email = lower(btrim(target_email))
    order by created_at desc
    limit 1
  );
end;
$$;

revoke all on function private.support_membership() from public, anon;
revoke all on function private.assign_shift_manager(uuid, text, text, uuid[]) from public, anon;
revoke all on function public.assign_shift_manager(uuid, text, text, uuid[]) from public, anon;

grant execute on function private.support_membership() to authenticated;
grant execute on function private.assign_shift_manager(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.assign_shift_manager(uuid, text, text, uuid[]) to authenticated;

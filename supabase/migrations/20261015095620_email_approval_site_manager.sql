-- A platform admin approves an email only. That person signs up with a full name,
-- then creates the business. Creating a business does not create a site.
-- A shift manager is invited to one site.

comment on table public.manager_invitations is 'Shift managers a company admin allowed to join one site.';

alter table public.manager_invitations
  add column site_id uuid;

alter table public.manager_invitations
  add constraint manager_invitations_site_fk
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade;

create or replace function private.approve_signup_email(target_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  cleaned_email text := lower(btrim(target_email));
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'approval is invalid' using errcode = '23514';
  end if;
  insert into public.founder_approvals (email, full_name)
  values (cleaned_email, cleaned_email)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.approve_signup_email(target_email text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.approve_signup_email(target_email);
$$;

create or replace function private.can_create_business()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.founder_approvals
    where email = (select private.actor_email())
      and consumed_at is null
      and organization_id is null
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
  manager public.manager_invitations%rowtype;
  invite public.site_invitations%rowtype;
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

  select * into manager
  from public.manager_invitations
  where email = lower(new.email) and consumed_at is null
  order by created_at
  limit 1
  for update;
  if manager.id is not null then
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

drop function if exists public.invite_shift_manager(uuid, text, text);
drop function if exists private.invite_shift_manager(uuid, text, text);

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
declare
  new_id uuid;
  cleaned_email text := lower(btrim(target_email));
begin
  if private.org_role(target_org) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.sites where id = target_site and org_id = target_org
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  if length(btrim(target_name)) = 0 or cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  insert into public.manager_invitations (org_id, site_id, email, full_name)
  values (target_org, target_site, cleaned_email, btrim(target_name))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.invite_shift_manager(
  target_org uuid,
  target_site uuid,
  target_name text,
  target_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.invite_shift_manager(target_org, target_site, target_name, target_email);
$$;

revoke all on function private.approve_signup_email(text) from public, anon;
revoke all on function public.approve_signup_email(text) from public, anon;
revoke all on function private.can_create_business() from public, anon;
revoke all on function private.invite_shift_manager(uuid, uuid, text, text) from public, anon;
revoke all on function public.invite_shift_manager(uuid, uuid, text, text) from public, anon;

grant usage on schema private to authenticated;

grant execute on function private.approve_signup_email(text) to authenticated;
grant execute on function public.approve_signup_email(text) to authenticated;
grant execute on function private.can_create_business() to authenticated;
grant execute on function private.invite_shift_manager(uuid, uuid, text, text) to authenticated;
grant execute on function public.invite_shift_manager(uuid, uuid, text, text) to authenticated;

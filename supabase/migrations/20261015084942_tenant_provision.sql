-- Organizations are the tenants. Login stays in auth.users; passwords are not copied
-- into a public table. Membership role owner is the company admin. Role manager is
-- the shift manager. Scheduled people stay in employees and cannot sign in.
-- A company exists only after the platform admin provisions it and its first admin.

alter table public.organizations
  add column status text not null default 'active' check (status in ('active', 'suspended'));

comment on column public.organizations.status is 'Tenant license: active or suspended.';
comment on table public.organizations is 'Tenants. One row per company. Login users are auth.users plus memberships, not a password table.';

create table public.manager_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (length(btrim(full_name)) > 0),
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create unique index manager_invitations_open_email_idx
  on public.manager_invitations (email)
  where consumed_at is null;

comment on table public.manager_invitations is 'Shift managers a company admin allowed to join the company.';

alter table public.manager_invitations enable row level security;
alter table public.manager_invitations force row level security;
revoke all on public.manager_invitations from public, anon, authenticated;
grant select on public.manager_invitations to authenticated;

create policy manager_invitations_read on public.manager_invitations
for select to authenticated
using (
  (select private.org_role(org_id)) = 'owner'
  or email = (select private.actor_email())
);

create or replace function private.org_role(target_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select membership.role
  from public.memberships membership
  join public.organizations tenant on tenant.id = membership.org_id
  where membership.org_id = target_org
    and membership.user_id = (select auth.uid())
    and tenant.status = 'active';
$$;

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
    select 1 from public.site_invitations
    where email = lower(btrim(target_email)) and consumed_at is null
  )
  or exists (
    select 1 from public.manager_invitations
    where email = lower(btrim(target_email)) and consumed_at is null
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
  update public.founder_approvals
  set consumed_at = now(), organization_id = new_id
  where id = approval_id;
  return new_id;
end;
$$;

create or replace function private.provision_company(
  org_name text,
  org_slug text,
  org_kind text,
  admin_name text,
  admin_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  cleaned_email text := lower(btrim(admin_email));
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if btrim(org_name) = ''
    or length(btrim(admin_name)) = 0
    or cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  then
    raise exception 'company is invalid' using errcode = '23514';
  end if;
  insert into public.organizations (name, slug, kind, status)
  values (btrim(org_name), org_slug, coalesce(org_kind, ''), 'active')
  returning id into new_id;
  insert into public.founder_approvals (email, full_name, organization_id)
  values (cleaned_email, btrim(admin_name), new_id);
  return new_id;
end;
$$;

create or replace function public.provision_company(
  org_name text,
  org_slug text,
  org_kind text,
  admin_name text,
  admin_email text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.provision_company(org_name, org_slug, org_kind, admin_name, admin_email);
$$;

create or replace function private.set_tenant_status(target_org uuid, next_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if next_status not in ('active', 'suspended') then
    raise exception 'status is invalid' using errcode = '23514';
  end if;
  update public.organizations set status = next_status where id = target_org;
  if not found then
    raise exception 'company is invalid' using errcode = '23514';
  end if;
  return true;
end;
$$;

create or replace function public.set_tenant_status(target_org uuid, next_status text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.set_tenant_status(target_org, next_status);
$$;

create or replace function private.list_tenants()
returns table (
  id uuid,
  name text,
  kind text,
  status text,
  admin_email text,
  admin_name text,
  admin_joined boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tenant.id,
    tenant.name,
    tenant.kind,
    tenant.status,
    approval.email,
    approval.full_name,
    approval.consumed_at is not null
  from public.organizations tenant
  left join lateral (
    select email, full_name, consumed_at
    from public.founder_approvals
    where organization_id = tenant.id
    order by created_at desc
    limit 1
  ) approval on true
  where private.is_platform_admin()
  order by tenant.created_at desc;
$$;

create or replace function public.list_tenants()
returns table (
  id uuid,
  name text,
  kind text,
  status text,
  admin_email text,
  admin_name text,
  admin_joined boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_tenants();
$$;

create or replace function private.invite_shift_manager(target_org uuid, target_name text, target_email text)
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
  if length(btrim(target_name)) = 0 or cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  insert into public.manager_invitations (org_id, email, full_name)
  values (target_org, cleaned_email, btrim(target_name))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.invite_shift_manager(target_org uuid, target_name text, target_email text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.invite_shift_manager(target_org, target_name, target_email);
$$;

create or replace function private.suspended_tenant_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tenant.name
  from public.memberships membership
  join public.organizations tenant on tenant.id = membership.org_id
  where membership.user_id = (select auth.uid())
    and tenant.status = 'suspended'
  order by tenant.name
  limit 1;
$$;

create view public.tenants with (security_invoker = true) as
select id, name, status, kind, created_at
from public.organizations;

revoke all on public.tenants from public, anon;
grant select on public.tenants to authenticated;

revoke all on function private.provision_company(text, text, text, text, text) from public, anon;
revoke all on function public.provision_company(text, text, text, text, text) from public, anon;
revoke all on function private.set_tenant_status(uuid, text) from public, anon;
revoke all on function public.set_tenant_status(uuid, text) from public, anon;
revoke all on function private.list_tenants() from public, anon;
revoke all on function public.list_tenants() from public, anon;
revoke all on function private.invite_shift_manager(uuid, text, text) from public, anon;
revoke all on function public.invite_shift_manager(uuid, text, text) from public, anon;
revoke all on function private.suspended_tenant_name() from public, anon;

grant usage on schema private to anon;

grant execute on function private.provision_company(text, text, text, text, text) to authenticated;
grant execute on function public.provision_company(text, text, text, text, text) to authenticated;
grant execute on function private.set_tenant_status(uuid, text) to authenticated;
grant execute on function public.set_tenant_status(uuid, text) to authenticated;
grant execute on function private.list_tenants() to authenticated;
grant execute on function public.list_tenants() to authenticated;
grant execute on function private.invite_shift_manager(uuid, text, text) to authenticated;
grant execute on function public.invite_shift_manager(uuid, text, text) to authenticated;
grant execute on function private.suspended_tenant_name() to authenticated;

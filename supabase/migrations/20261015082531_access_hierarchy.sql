-- A business is an organization. A site belongs to one business.
-- A user can sign in. An employee is only a person on a site's schedule and has no login.
-- The first user of a new business exists only after a platform admin approves that email.

create table public.platform_admin_emails (
  email text primary key check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create table public.founder_approvals (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (length(btrim(full_name)) > 0),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  organization_id uuid references public.organizations (id) on delete set null
);

create unique index founder_approvals_open_email_idx
  on public.founder_approvals (email)
  where consumed_at is null;

create table public.site_memberships (
  org_id uuid not null,
  site_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('manager', 'employee')),
  created_at timestamptz not null default now(),
  primary key (site_id, user_id),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

create index site_memberships_org_id_idx on public.site_memberships (org_id);
create index site_memberships_user_id_idx on public.site_memberships (user_id);

create table public.site_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (length(btrim(full_name)) > 0),
  role text not null check (role in ('manager', 'employee')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

create unique index site_invitations_open_email_idx
  on public.site_invitations (org_id, email)
  where consumed_at is null;

comment on table public.organizations is 'Businesses. One row per company.';
comment on table public.sites is 'Workplaces of one business.';
comment on table public.memberships is 'Users who can sign in to a business. Role employee here means read access, not a scheduled person.';
comment on table public.site_memberships is 'Users of one site. Owners are not listed here; they cover every site of the business.';
comment on table public.employees is 'People placed on a schedule. They have no login. Which site they belong to is employee_sites.';
comment on column public.employees.user_id is 'Unused for access. An employee is not a user.';
comment on table public.founder_approvals is 'Emails a platform admin allowed to open the first account and business.';
comment on table public.site_invitations is 'Emails a business owner allowed to join one site.';

alter table public.platform_admin_emails enable row level security;
alter table public.founder_approvals enable row level security;
alter table public.site_memberships enable row level security;
alter table public.site_invitations enable row level security;
alter table public.platform_admin_emails force row level security;
alter table public.founder_approvals force row level security;
alter table public.site_memberships force row level security;
alter table public.site_invitations force row level security;

revoke all on public.platform_admin_emails from public, anon, authenticated;
revoke all on public.founder_approvals from public, anon, authenticated;
revoke all on public.site_memberships from public, anon, authenticated;
revoke all on public.site_invitations from public, anon, authenticated;
grant select on public.founder_approvals, public.site_memberships, public.site_invitations to authenticated;

create or replace function private.actor_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(email) from auth.users where id = (select auth.uid());
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admin_emails admin
    join auth.users account on lower(account.email) = admin.email
    where account.id = (select auth.uid())
  );
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
  );
$$;

create or replace function public.signup_allowed(target_email text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.signup_allowed(target_email);
$$;

create or replace function private.reject_unapproved_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select rolsuper from pg_roles where rolname = session_user), false) then
    return new;
  end if;
  if private.signup_allowed(new.email) then
    return new;
  end if;
  raise exception 'signup_not_approved' using errcode = '42501';
end;
$$;

create trigger reject_unapproved_signup
  before insert on auth.users
  for each row execute function private.reject_unapproved_signup();

create or replace function private.attach_invited_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.site_invitations%rowtype;
begin
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

create trigger on_auth_user_invited
  after insert on auth.users
  for each row execute function private.attach_invited_user();

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
  where email = actor_email and consumed_at is null
  order by created_at
  limit 1
  for update;
  if approval_id is null then
    raise exception 'organization is not approved' using errcode = '42501';
  end if;
  insert into public.organizations (name, slug, kind)
  values (btrim(org_name), org_slug, coalesce(org_kind, ''))
  returning id into new_id;
  insert into public.memberships (org_id, user_id, role)
  values (new_id, actor, 'owner');
  update public.founder_approvals
  set consumed_at = now(), organization_id = new_id
  where id = approval_id;
  return new_id;
end;
$$;

create or replace function private.approve_founder(target_name text, target_email text)
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
  if length(btrim(target_name)) = 0 or cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'approval is invalid' using errcode = '23514';
  end if;
  insert into public.founder_approvals (email, full_name)
  values (cleaned_email, btrim(target_name))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.approve_founder(target_name text, target_email text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.approve_founder(target_name, target_email);
$$;

create or replace function private.invite_site_user(
  target_site uuid,
  target_name text,
  target_email text,
  target_role text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  new_id uuid;
  cleaned_email text := lower(btrim(target_email));
begin
  select org_id into target_org from public.sites where id = target_site;
  if target_org is null or private.org_role(target_org) is distinct from 'owner' then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if target_role not in ('manager', 'employee')
    or length(btrim(target_name)) = 0
    or cleaned_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  insert into public.site_invitations (org_id, site_id, email, full_name, role)
  values (target_org, target_site, cleaned_email, btrim(target_name), target_role)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.invite_site_user(
  target_site uuid,
  target_name text,
  target_email text,
  target_role text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.invite_site_user(target_site, target_name, target_email, target_role);
$$;

create policy platform_admin_emails_none on public.platform_admin_emails
for select to authenticated
using (false);

create policy founder_approvals_read on public.founder_approvals
for select to authenticated
using (
  (select private.is_platform_admin())
  or email = (select private.actor_email())
);

create policy site_memberships_read on public.site_memberships
for select to authenticated
using ((select private.org_role(org_id)) is not null);

create policy site_invitations_read on public.site_invitations
for select to authenticated
using (
  (select private.org_role(org_id)) = 'owner'
  or email = (select private.actor_email())
);

create view public.businesses with (security_invoker = true) as
select id, name, kind, created_at from public.organizations;

create view public.site_users with (security_invoker = true) as
select
  membership.org_id,
  business.name as business,
  membership.site_id,
  site.name as site,
  membership.user_id,
  profile.email,
  profile.name as full_name,
  membership.role
from public.site_memberships membership
join public.organizations business on business.id = membership.org_id
join public.sites site on site.id = membership.site_id
left join public.profiles profile on profile.user_id = membership.user_id;

create view public.site_employees with (security_invoker = true) as
select
  employee.org_id,
  business.name as business,
  link.site_id,
  site.name as site,
  employee.id as employee_id,
  employee.name,
  employee.job_title,
  employee.active
from public.employees employee
join public.employee_sites link on link.employee_id = employee.id and link.org_id = employee.org_id
join public.organizations business on business.id = employee.org_id
join public.sites site on site.id = link.site_id;

revoke all on public.businesses, public.site_users, public.site_employees from public, anon;
grant select on public.businesses, public.site_users, public.site_employees to authenticated;

revoke all on function private.actor_email() from public, anon;
revoke all on function private.is_platform_admin() from public, anon;
revoke all on function private.signup_allowed(text) from public, anon;
revoke all on function private.reject_unapproved_signup() from public, anon;
revoke all on function private.attach_invited_user() from public, anon;
revoke all on function private.approve_founder(text, text) from public, anon;
revoke all on function private.invite_site_user(uuid, text, text, text) from public, anon;
revoke all on function public.signup_allowed(text) from public;
revoke all on function public.approve_founder(text, text) from public, anon;
revoke all on function public.invite_site_user(uuid, text, text, text) from public, anon;

grant execute on function private.actor_email() to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.signup_allowed(text) to anon, authenticated;
grant execute on function public.signup_allowed(text) to anon, authenticated;
grant execute on function private.approve_founder(text, text) to authenticated;
grant execute on function public.approve_founder(text, text) to authenticated;
grant execute on function private.invite_site_user(uuid, text, text, text) to authenticated;
grant execute on function public.invite_site_user(uuid, text, text, text) to authenticated;

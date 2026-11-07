-- The super admin list is the people approved to open a business.
-- An employee login is not one of those approvals, even when the same address was stored beside an organization.

create or replace function private.list_owner_approvals()
returns table (
  id uuid,
  email text,
  full_name text,
  consumed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select approval.id, approval.email, approval.full_name, approval.consumed_at
  from public.founder_approvals approval
  where private.is_platform_admin()
    and (
      approval.organization_id is null
      or exists (
        select 1
        from public.memberships membership
        join auth.users account on account.id = membership.user_id
        where membership.org_id = approval.organization_id
          and membership.role = 'owner'
          and lower(account.email) = lower(approval.email)
      )
    )
  order by approval.created_at desc;
$$;

create or replace function public.list_owner_approvals()
returns table (
  id uuid,
  email text,
  full_name text,
  consumed_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_owner_approvals();
$$;

revoke all on function private.list_owner_approvals() from public, anon, authenticated;
revoke all on function public.list_owner_approvals() from public, anon;
grant execute on function public.list_owner_approvals() to authenticated;

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
    owner_user.email,
    coalesce(nullif(btrim(owner_profile.name), ''), nullif(btrim(owner_approval.full_name), ''), ''),
    owner_user.email is not null
  from public.organizations tenant
  left join lateral (
    select account.id, account.email
    from public.memberships membership
    join auth.users account on account.id = membership.user_id
    where membership.org_id = tenant.id and membership.role = 'owner'
    order by membership.created_at
    limit 1
  ) owner_user on true
  left join public.profiles owner_profile on owner_profile.user_id = owner_user.id
  left join lateral (
    select full_name
    from public.founder_approvals approval
    where approval.organization_id = tenant.id and lower(approval.email) = lower(owner_user.email)
    order by approval.created_at desc
    limit 1
  ) owner_approval on true
  where private.is_platform_admin()
  order by tenant.created_at desc;
$$;

-- A roster employee can sign in. The login is a membership with role employee,
-- linked to public.employees.user_id. They write only their own availability.
-- Published schedules stay the only schedules they can read.

create unique index employees_one_login_idx
  on public.employees (org_id, user_id)
  where user_id is not null;

comment on column public.employees.user_id is
  'Auth user linked to this roster person. Membership role employee is what lets them sign in.';

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

create unique index staff_invitations_open_email_idx
  on public.staff_invitations (org_id, email)
  where consumed_at is null;

create unique index staff_invitations_open_employee_idx
  on public.staff_invitations (employee_id)
  where consumed_at is null;

alter table public.staff_invitations enable row level security;
alter table public.staff_invitations force row level security;
revoke all on table public.staff_invitations from public, anon, authenticated;
grant select on table public.staff_invitations to authenticated;

create policy staff_invitations_read on public.staff_invitations
for select to authenticated
using ((select private.org_role(org_id)) = 'owner');

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
  )
  or exists (
    select 1 from public.staff_invitations
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
  staff public.staff_invitations%rowtype;
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

  for staff in
    select *
    from public.staff_invitations
    where email = lower(new.email) and consumed_at is null
    order by created_at
    for update
  loop
    if exists (
      select 1
      from public.memberships
      where org_id = staff.org_id and user_id = new.id and role <> 'employee'
    ) then
      continue;
    end if;
    attached := true;
    insert into public.memberships (org_id, user_id, role)
    values (staff.org_id, new.id, 'employee')
    on conflict (org_id, user_id) do nothing;
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select es.org_id, es.site_id, new.id, 'employee'
    from public.employee_sites es
    where es.employee_id = staff.employee_id and es.org_id = staff.org_id
    on conflict (site_id, user_id) do nothing;
    update public.employees
    set user_id = new.id
    where id = staff.employee_id and org_id = staff.org_id and user_id is null;
    update public.profiles
    set name = coalesce(
      nullif(btrim(name), ''),
      (select e.name from public.employees e where e.id = staff.employee_id)
    )
    where user_id = new.id;
    update public.staff_invitations set consumed_at = now() where id = staff.id;
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
  if private.org_role(target_org) is distinct from 'owner' then
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
    select 1 from public.manager_invitations
    where email = cleaned_email and consumed_at is null
  ) or exists (
    select 1 from public.founder_approvals
    where email = cleaned_email and consumed_at is null
  ) or exists (
    select 1 from public.site_invitations
    where email = cleaned_email and consumed_at is null
  ) or exists (
    select 1
    from public.staff_invitations
    where email = cleaned_email and consumed_at is null and employee_id <> target_employee
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
    update public.staff_invitations
    set consumed_at = now()
    where org_id = target_org and employee_id = target_employee and consumed_at is null;
    return 'linked';
  end if;

  delete from public.staff_invitations
  where org_id = target_org and employee_id = target_employee and consumed_at is null;
  insert into public.staff_invitations (org_id, employee_id, email)
  values (target_org, target_employee, cleaned_email);
  return 'invited';
end;
$$;

create or replace function public.assign_staff_login(
  target_org uuid,
  target_employee uuid,
  target_email text
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.assign_staff_login(target_org, target_employee, target_email);
$$;

revoke all on function private.assign_staff_login(uuid, uuid, text) from public, anon;
revoke all on function public.assign_staff_login(uuid, uuid, text) from public, anon;
grant execute on function private.assign_staff_login(uuid, uuid, text) to authenticated;
grant execute on function public.assign_staff_login(uuid, uuid, text) to authenticated;

-- A signed-in employee can read the sites they belong to, and the shifts on those sites.
create or replace function private.site_member(target_site uuid, target_org uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.org_role(target_org) is not null
    and (
      private.is_manager(target_org)
      or exists (
        select 1
        from public.site_memberships
        where site_id = target_site
          and org_id = target_org
          and user_id = (select auth.uid())
      )
    );
$$;

revoke all on function private.site_member(uuid, uuid) from public, anon;
grant execute on function private.site_member(uuid, uuid) to authenticated;

drop policy sites_read on public.sites;
create policy sites_read on public.sites
for select to authenticated
using ((select private.site_member(id, org_id)));

drop policy shifts_read on public.shifts;
create policy shifts_read on public.shifts
for select to authenticated
using ((select private.site_member(site_id, org_id)));

drop policy shift_requirements_read on public.shift_requirements;
create policy shift_requirements_read on public.shift_requirements
for select to authenticated
using (
  exists (
    select 1
    from public.shifts s
    where s.id = shift_requirements.shift_id
      and s.org_id = shift_requirements.org_id
      and (select private.site_member(s.site_id, s.org_id))
  )
);

drop policy employee_sites_read on public.employee_sites;
create policy employee_sites_read on public.employee_sites
for select to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
  or (select private.employee_visible(employee_id, org_id))
);

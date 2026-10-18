-- A roster person belongs to one business and can be linked to several of its sites.
-- The person is employees.id plus phone. A login (user_id) is optional.

alter table public.employees
  add column phone text not null default '';

create index employees_org_phone_idx on public.employees (org_id, phone) where phone <> '';

comment on table public.organizations is
  'A business. Its sites, roster, and sign-in memberships are never shared with another business.';
comment on table public.sites is
  'A workplace of one business. Shift definitions and weekly schedules belong to the site.';
comment on table public.employees is
  'A person on one business roster. The same employees.id can be linked to several sites of that business. Across sites the person is this id and phone, not the name and not a login.';
comment on column public.employees.phone is
  'Phone number of the roster person. Empty is allowed. It is not a login.';
comment on column public.employees.user_id is
  'Optional login. A roster person does not need an account.';
comment on table public.employee_sites is
  'Which sites of the same business a roster person may be scheduled at. The employee and the site must belong to that business.';
comment on table public.shifts is
  'A shift definition of one site.';
comment on table public.schedules is
  'One week at one site.';
comment on table public.assignments is
  'A roster person placed on one shift of one site''s week.';
comment on table public.memberships is
  'Who can sign in to the business: the owner, a shift manager, or an employee login.';
comment on table public.site_memberships is
  'Which sites a shift manager or an employee login may open. Owners are not listed; they cover every site of the business.';

create or replace function private.manages_site(target_site uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites site
    where site.id = target_site
      and (
        private.org_role(site.org_id) = 'owner'
        or exists (
          select 1
          from public.site_memberships membership
          where membership.site_id = site.id
            and membership.org_id = site.org_id
            and membership.user_id = (select auth.uid())
            and membership.role = 'manager'
        )
      )
  );
$$;

revoke all on function private.manages_site(uuid) from public, anon;
grant execute on function private.manages_site(uuid) to authenticated;

drop policy if exists employee_sites_insert on public.employee_sites;
drop policy if exists employee_sites_update on public.employee_sites;
drop policy if exists employee_sites_delete on public.employee_sites;

create policy employee_sites_insert on public.employee_sites
for insert to authenticated
with check ((select private.manages_site(site_id)));

create policy employee_sites_update on public.employee_sites
for update to authenticated
using ((select private.manages_site(site_id)))
with check ((select private.manages_site(site_id)));

create policy employee_sites_delete on public.employee_sites
for delete to authenticated
using ((select private.manages_site(site_id)));

-- When a roster person already has a login, linking a site lets that login open the site.
create or replace function private.sync_staff_site_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_user uuid;
begin
  if tg_op = 'INSERT' then
    select employee.user_id into linked_user
    from public.employees employee
    where employee.id = new.employee_id and employee.org_id = new.org_id;
    if linked_user is not null then
      insert into public.site_memberships (org_id, site_id, user_id, role)
      values (new.org_id, new.site_id, linked_user, 'employee')
      on conflict (site_id, user_id) do nothing;
    end if;
    return new;
  end if;

  select employee.user_id into linked_user
  from public.employees employee
  where employee.id = old.employee_id and employee.org_id = old.org_id;
  if linked_user is not null then
    delete from public.site_memberships membership
    where membership.site_id = old.site_id
      and membership.user_id = linked_user
      and membership.org_id = old.org_id
      and membership.role = 'employee';
  end if;
  return old;
end;
$$;

drop trigger if exists employee_sites_sync_login on public.employee_sites;
create trigger employee_sites_sync_login
after insert or delete on public.employee_sites
for each row execute function private.sync_staff_site_membership();

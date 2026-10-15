-- Role split on top of org membership.
-- owner: company settings and who belongs
-- owner, manager: employees, agreements, shifts, schedules
-- employee: published schedule, own agreement, own availability
-- Authorization reads memberships, never JWT user_metadata.

drop policy if exists member_all on public.organizations;
drop policy if exists member_all on public.memberships;
drop policy if exists member_all on public.sites;
drop policy if exists member_all on public.qualifications;
drop policy if exists member_all on public.employees;
drop policy if exists member_all on public.employee_qualifications;
drop policy if exists member_all on public.employee_sites;
drop policy if exists member_all on public.shifts;
drop policy if exists member_all on public.shift_requirements;
drop policy if exists member_all on public.employee_agreements;
drop policy if exists member_all on public.employee_preferences;
drop policy if exists member_all on public.availability_weeks;
drop policy if exists member_all on public.availability_entries;
drop policy if exists member_all on public.schedules;
drop policy if exists member_all on public.assignments;
drop policy if exists member_all on public.assignment_extensions;
drop policy if exists member_all on public.assignment_locks;
drop policy if exists member_all on public.assignment_overages;

create index employees_org_user_idx on public.employees (org_id, user_id) where user_id is not null;

create or replace function private.org_role(target_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.memberships
  where org_id = target_org
    and user_id = (select auth.uid());
$$;

create or replace function private.is_manager(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_role(target_org) in ('owner', 'manager');
$$;

create or replace function private.owns_employee(target_employee uuid, target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees
    where id = target_employee
      and org_id = target_org
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.employee_visible(target_employee uuid, target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_role(target_org) is not null
    and (
      private.is_manager(target_org)
      or private.owns_employee(target_employee, target_org)
      or exists (
        select 1
        from public.assignments
        join public.schedules on schedules.id = assignments.schedule_id
        where assignments.employee_id = target_employee
          and assignments.org_id = target_org
          and schedules.status = 'published'
      )
    );
$$;

create or replace function private.schedule_visible(target_schedule uuid, target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.schedules
    where id = target_schedule
      and org_id = target_org
      and private.org_role(target_org) is not null
      and (private.is_manager(target_org) or status = 'published')
  );
$$;

create or replace function private.create_organization(org_name text, org_slug text, org_kind text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  new_id uuid;
begin
  if actor is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if btrim(org_name) = '' then
    raise exception 'organization name is required' using errcode = '23514';
  end if;
  insert into public.organizations (name, slug, kind)
  values (btrim(org_name), org_slug, coalesce(org_kind, ''))
  returning id into new_id;
  insert into public.memberships (org_id, user_id, role)
  values (new_id, actor, 'owner');
  return new_id;
end;
$$;

-- Exposed wrapper. The definer body stays in private, which the Data API does not publish.
create or replace function public.create_organization(org_name text, org_slug text, org_kind text default '')
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_organization(org_name, org_slug, org_kind);
$$;

create or replace function private.keep_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
    and (tg_op = 'DELETE' or new.role is distinct from 'owner')
    and (
      select count(*)
      from public.memberships
      where org_id = old.org_id
        and role = 'owner'
        and user_id <> old.user_id
    ) = 0
  then
    raise exception 'organization must keep an owner' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger memberships_keep_owner
before update or delete on public.memberships
for each row execute function private.keep_last_owner();

revoke all on function private.org_role(uuid) from public, anon;
revoke all on function private.is_manager(uuid) from public, anon;
revoke all on function private.owns_employee(uuid, uuid) from public, anon;
revoke all on function private.employee_visible(uuid, uuid) from public, anon;
revoke all on function private.schedule_visible(uuid, uuid) from public, anon;
revoke all on function private.create_organization(text, text, text) from public, anon;
revoke all on function private.keep_last_owner() from public, anon;
revoke all on function public.create_organization(text, text, text) from public, anon;
grant execute on function private.org_role(uuid) to authenticated;
grant execute on function private.is_manager(uuid) to authenticated;
grant execute on function private.owns_employee(uuid, uuid) to authenticated;
grant execute on function private.employee_visible(uuid, uuid) to authenticated;
grant execute on function private.schedule_visible(uuid, uuid) to authenticated;
grant execute on function private.create_organization(text, text, text) to authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;

create policy organizations_read on public.organizations
for select to authenticated
using ((select private.org_role(id)) is not null);

create policy organizations_update on public.organizations
for update to authenticated
using ((select private.org_role(id)) = 'owner')
with check ((select private.org_role(id)) = 'owner');

create policy organizations_delete on public.organizations
for delete to authenticated
using ((select private.org_role(id)) = 'owner');

create policy memberships_read on public.memberships
for select to authenticated
using ((select private.org_role(org_id)) is not null);

create policy memberships_insert on public.memberships
for insert to authenticated
with check ((select private.org_role(org_id)) = 'owner');

create policy memberships_update on public.memberships
for update to authenticated
using ((select private.org_role(org_id)) = 'owner')
with check ((select private.org_role(org_id)) = 'owner');

create policy memberships_delete on public.memberships
for delete to authenticated
using ((select private.org_role(org_id)) = 'owner');

do $manager_tables$
declare
  table_name text;
begin
  foreach table_name in array array[
    'sites',
    'qualifications',
    'shifts',
    'shift_requirements'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.org_role(org_id)) is not null)',
      table_name || '_read',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_manager(org_id)))',
      table_name || '_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_manager(org_id))) with check ((select private.is_manager(org_id)))',
      table_name || '_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_manager(org_id)))',
      table_name || '_delete',
      table_name
    );
  end loop;
end
$manager_tables$;

create policy employees_read on public.employees
for select to authenticated
using ((select private.employee_visible(id, org_id)));

create policy employees_insert on public.employees
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy employees_update on public.employees
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy employees_delete on public.employees
for delete to authenticated
using ((select private.is_manager(org_id)));

create policy employee_qualifications_read on public.employee_qualifications
for select to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
);

create policy employee_qualifications_insert on public.employee_qualifications
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy employee_qualifications_update on public.employee_qualifications
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy employee_qualifications_delete on public.employee_qualifications
for delete to authenticated
using ((select private.is_manager(org_id)));

create policy employee_sites_read on public.employee_sites
for select to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
);

create policy employee_sites_insert on public.employee_sites
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy employee_sites_update on public.employee_sites
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy employee_sites_delete on public.employee_sites
for delete to authenticated
using ((select private.is_manager(org_id)));

create policy employee_agreements_read on public.employee_agreements
for select to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
);

create policy employee_agreements_insert on public.employee_agreements
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy employee_agreements_update on public.employee_agreements
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy employee_agreements_delete on public.employee_agreements
for delete to authenticated
using ((select private.is_manager(org_id)));

create policy employee_preferences_read on public.employee_preferences
for select to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
);

create policy employee_preferences_insert on public.employee_preferences
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy employee_preferences_update on public.employee_preferences
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy employee_preferences_delete on public.employee_preferences
for delete to authenticated
using ((select private.is_manager(org_id)));

create policy availability_weeks_all on public.availability_weeks
for all to authenticated
using (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
)
with check (
  (select private.is_manager(org_id))
  or (select private.owns_employee(employee_id, org_id))
);

create policy availability_entries_all on public.availability_entries
for all to authenticated
using (
  (select private.is_manager(org_id))
  or exists (
    select 1
    from public.availability_weeks
    where availability_weeks.id = availability_entries.availability_week_id
      and availability_weeks.org_id = availability_entries.org_id
      and (
        (select private.is_manager(availability_weeks.org_id))
        or (select private.owns_employee(availability_weeks.employee_id, availability_weeks.org_id))
      )
  )
)
with check (
  (select private.is_manager(org_id))
  or exists (
    select 1
    from public.availability_weeks
    where availability_weeks.id = availability_entries.availability_week_id
      and availability_weeks.org_id = availability_entries.org_id
      and (
        (select private.is_manager(availability_weeks.org_id))
        or (select private.owns_employee(availability_weeks.employee_id, availability_weeks.org_id))
      )
  )
);

create policy schedules_read on public.schedules
for select to authenticated
using ((select private.schedule_visible(id, org_id)));

create policy schedules_insert on public.schedules
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy schedules_update on public.schedules
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy schedules_delete on public.schedules
for delete to authenticated
using ((select private.is_manager(org_id)));

do $schedule_children$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assignments',
    'assignment_extensions',
    'assignment_locks',
    'assignment_overages'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.schedule_visible(schedule_id, org_id)))',
      table_name || '_read',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.is_manager(org_id)))',
      table_name || '_insert',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.is_manager(org_id))) with check ((select private.is_manager(org_id)))',
      table_name || '_update',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.is_manager(org_id)))',
      table_name || '_delete',
      table_name
    );
  end loop;
end
$schedule_children$;

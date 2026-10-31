-- A person is an employee with a login. The direct manager is whoever opened the account.
-- Anyone above them can see that person and act for them.
-- Permissions are chosen from the permissions the creator holds.

alter table public.employees
  add column reports_to uuid,
  add column opened_by uuid,
  add column capabilities jsonb not null default '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":false,"site_settings":false,"people_site":false,"people_edit":false,"messages":false,"insights":false,"documents":false}'::jsonb;

alter table public.employees
  add constraint employees_reports_not_self check (reports_to is null or reports_to <> id),
  add constraint employees_opened_not_self check (opened_by is null or opened_by <> id),
  add constraint employees_capabilities_object check (jsonb_typeof(capabilities) = 'object');

create index employees_reports_to_idx on public.employees (reports_to) where reports_to is not null;
create index employees_opened_by_idx on public.employees (opened_by) where opened_by is not null;

comment on column public.employees.reports_to is 'Direct manager. Null only for the most senior people in the company.';
comment on column public.employees.opened_by is 'Employee who opened this account. They can move direct management to a manager under them.';
comment on column public.employees.capabilities is 'Permissions chosen for this person: clock, constraints, absences, trades, schedule_view, schedule_edit, site_settings, people_site, people_edit, messages, insights, documents.';

insert into public.employees (org_id, user_id, name, email, home_site_id)
select m.org_id,
       m.user_id,
       coalesce(nullif(btrim(p.name), ''), nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'Owner'),
       coalesce(p.email, ''),
       (select s.id from public.sites s where s.org_id = m.org_id order by s.created_at, s.name limit 1)
from public.memberships m
left join public.profiles p on p.user_id = m.user_id
where m.role = 'owner'
  and not exists (
    select 1 from public.employees e
    where e.org_id = m.org_id and e.user_id = m.user_id
  );

insert into public.employees (org_id, user_id, name, email, home_site_id)
select m.org_id,
       m.user_id,
       coalesce(nullif(btrim(p.name), ''), nullif(split_part(coalesce(p.email, ''), '@', 1), ''), 'Manager'),
       coalesce(p.email, ''),
       (select sm.site_id from public.site_memberships sm where sm.org_id = m.org_id and sm.user_id = m.user_id order by sm.created_at limit 1)
from public.memberships m
left join public.profiles p on p.user_id = m.user_id
where m.role = 'manager'
  and not exists (
    select 1 from public.employees e
    where e.org_id = m.org_id and e.user_id = m.user_id
  );

insert into public.employee_sites (org_id, employee_id, site_id)
select e.org_id, e.id, sm.site_id
from public.employees e
join public.site_memberships sm on sm.org_id = e.org_id and sm.user_id = e.user_id
on conflict do nothing;

insert into public.employee_sites (org_id, employee_id, site_id)
select e.org_id, e.id, s.id
from public.employees e
join public.memberships m on m.org_id = e.org_id and m.user_id = e.user_id and m.role = 'owner'
join public.sites s on s.org_id = e.org_id
on conflict do nothing;

update public.employees e
set home_site_id = (
  select es.site_id
  from public.employee_sites es
  join public.sites s on s.id = es.site_id
  where es.employee_id = e.id
  order by s.created_at, s.name
  limit 1
)
where e.home_site_id is null
  and e.user_id is not null
  and exists (
    select 1 from public.memberships m
    where m.org_id = e.org_id and m.user_id = e.user_id and m.role in ('owner', 'manager')
  );

update public.employees e
set capabilities = '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":true,"site_settings":true,"people_site":true,"people_edit":true,"messages":true,"insights":true,"documents":true}'::jsonb,
    reports_to = null
from public.memberships m
where m.org_id = e.org_id and m.user_id = e.user_id and m.role = 'owner';

update public.employees e
set capabilities = '{"clock":true,"constraints":true,"absences":true,"trades":true,"schedule_view":true,"schedule_edit":true,"site_settings":true,"people_site":true,"people_edit":true,"messages":true,"insights":true,"documents":true}'::jsonb
from public.memberships m
where m.org_id = e.org_id and m.user_id = e.user_id and m.role = 'manager';

update public.employees e
set reports_to = (
  select owner_employee.id
  from public.employees owner_employee
  join public.memberships owner_membership
    on owner_membership.org_id = owner_employee.org_id
   and owner_membership.user_id = owner_employee.user_id
   and owner_membership.role = 'owner'
  where owner_employee.org_id = e.org_id
  order by owner_membership.created_at, owner_employee.id
  limit 1
)
where e.reports_to is null
  and not exists (
    select 1 from public.memberships m
    where m.org_id = e.org_id and m.user_id = e.user_id and m.role = 'owner'
  );

update public.employees
set opened_by = reports_to
where opened_by is null and reports_to is not null;

alter table public.employees
  add constraint employees_reports_to_fk
  foreign key (reports_to, org_id) references public.employees (id, org_id) on delete restrict;

alter table public.employees
  add constraint employees_opened_by_fk
  foreign key (opened_by, org_id) references public.employees (id, org_id) on delete restrict;

create or replace function private.actor_employee(target_org uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.employees
  where org_id = target_org
    and user_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.is_ancestor(ancestor uuid, descendant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select id, reports_to, array[id] as path, 0 as depth
    from public.employees
    where id = descendant
    union all
    select parent.id, parent.reports_to, chain.path || parent.id, chain.depth + 1
    from chain
    join public.employees parent on parent.id = chain.reports_to
    where chain.reports_to is not null
      and chain.depth < 32
      and not parent.id = any (chain.path)
  )
  select ancestor is not null
    and ancestor is distinct from descendant
    and exists (
      select 1 from chain
      where id = ancestor and id is distinct from descendant
    );
$$;

create or replace function private.oversees(target_org uuid, target_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_ancestor(private.actor_employee(target_org), target_employee);
$$;

create or replace function private.has_capability(target_org uuid, key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_role(target_org) = 'owner'
    or exists (
      select 1
      from public.employees e
      where e.org_id = target_org
        and e.user_id = (select auth.uid())
        and coalesce((e.capabilities ->> key)::boolean, false)
    );
$$;

create or replace function private.employee_is_lead(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = target
      and (
        coalesce((e.capabilities ->> 'schedule_edit')::boolean, false)
        or coalesce((e.capabilities ->> 'site_settings')::boolean, false)
        or coalesce((e.capabilities ->> 'people_site')::boolean, false)
        or coalesce((e.capabilities ->> 'people_edit')::boolean, false)
        or coalesce((e.capabilities ->> 'messages')::boolean, false)
        or coalesce((e.capabilities ->> 'insights')::boolean, false)
        or coalesce((e.capabilities ->> 'documents')::boolean, false)
        or exists (
          select 1
          from public.memberships m
          where m.user_id = e.user_id
            and m.org_id = e.org_id
            and m.role = 'owner'
        )
      )
  );
$$;

create or replace function private.capabilities_within(actor uuid, value jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select actor is not null
    and not exists (
      select 1
      from jsonb_each(value) as item(key, val)
      where item.val = 'true'::jsonb
        and not coalesce((
          select (e.capabilities ->> item.key)::boolean
          from public.employees e
          where e.id = actor
        ), false)
    );
$$;

create or replace function private.can_write_employee(target_employee uuid, target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_role(target_org) = 'owner'
    or private.oversees(target_org, target_employee)
    or (
      private.is_manager(target_org)
      and private.owns_employee(target_employee, target_org)
    )
    or (
      private.is_manager(target_org)
      and (
        private.actor_employee(target_org) is null
        or private.has_capability(target_org, 'people_site')
      )
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
      private.org_role(target_org) = 'owner'
      or private.owns_employee(target_employee, target_org)
      or private.oversees(target_org, target_employee)
      or (
        private.is_manager(target_org)
        and (
          private.actor_employee(target_org) is null
          or private.has_capability(target_org, 'people_site')
        )
      )
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
  select private.org_role(target_org) is not null
    and (
      (
        private.is_manager(target_org)
        and (
          private.actor_employee(target_org) is null
          or private.has_capability(target_org, 'schedule_edit')
          or private.has_capability(target_org, 'people_site')
          or private.org_role(target_org) = 'owner'
        )
      )
      or exists (
        select 1
        from public.schedules
        where id = target_schedule
          and org_id = target_org
          and status = 'published'
      )
      or exists (
        select 1
        from public.assignments
        where schedule_id = target_schedule
          and org_id = target_org
          and private.oversees(target_org, employee_id)
      )
    );
$$;

create or replace function private.guard_employee_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
begin
  if (select auth.uid()) is null or private.org_role(new.org_id) = 'owner' then
    return new;
  end if;
  actor := private.actor_employee(new.org_id);
  if private.is_manager(new.org_id) and actor is null then
    return new;
  end if;
  if actor is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.reports_to is null then
      new.reports_to := actor;
    end if;
    if new.opened_by is null then
      new.opened_by := actor;
    end if;
    if new.reports_to is distinct from actor and not private.is_ancestor(actor, new.reports_to) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if new.opened_by is distinct from actor and not private.is_ancestor(actor, new.opened_by) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.reports_to is distinct from old.reports_to then
    if not (private.oversees(new.org_id, old.id) or old.opened_by = actor) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    if new.reports_to is null
      or (
        new.reports_to is distinct from actor
        and not (private.is_ancestor(actor, new.reports_to) and private.employee_is_lead(new.reports_to))
      )
    then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.capabilities is distinct from old.capabilities then
    if not private.capabilities_within(actor, new.capabilities) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  end if;
  if new.reports_to is not null and private.is_ancestor(new.id, new.reports_to) then
    raise exception 'reporting cycle' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.sync_login_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.memberships
    where org_id = new.org_id and user_id = new.user_id and role = 'owner'
  ) then
    return new;
  end if;
  if private.employee_is_lead(new.id) then
    update public.memberships
    set role = 'manager'
    where org_id = new.org_id and user_id = new.user_id and role = 'employee';
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select new.org_id, es.site_id, new.user_id, 'manager'
    from public.employee_sites es
    where es.employee_id = new.id
    on conflict (site_id, user_id) do update set role = 'manager';
  else
    update public.memberships
    set role = 'employee'
    where org_id = new.org_id and user_id = new.user_id and role = 'manager';
    update public.site_memberships
    set role = 'employee'
    where org_id = new.org_id and user_id = new.user_id and role = 'manager';
  end if;
  return new;
end;
$$;

create trigger employees_guard_authority
before insert or update on public.employees
for each row execute function private.guard_employee_authority();

create trigger employees_sync_login_authority
after insert or update of capabilities, user_id on public.employees
for each row execute function private.sync_login_authority();

revoke all on function private.actor_employee(uuid) from public, anon;
revoke all on function private.is_ancestor(uuid, uuid) from public, anon;
revoke all on function private.oversees(uuid, uuid) from public, anon;
revoke all on function private.has_capability(uuid, text) from public, anon;
revoke all on function private.employee_is_lead(uuid) from public, anon;
revoke all on function private.capabilities_within(uuid, jsonb) from public, anon;
revoke all on function private.can_write_employee(uuid, uuid) from public, anon;
revoke all on function private.guard_employee_authority() from public, anon;
revoke all on function private.sync_login_authority() from public, anon;
grant execute on function private.actor_employee(uuid) to authenticated;
grant execute on function private.is_ancestor(uuid, uuid) to authenticated;
grant execute on function private.oversees(uuid, uuid) to authenticated;
grant execute on function private.has_capability(uuid, text) to authenticated;
grant execute on function private.employee_is_lead(uuid) to authenticated;
grant execute on function private.capabilities_within(uuid, jsonb) to authenticated;
grant execute on function private.can_write_employee(uuid, uuid) to authenticated;

drop policy employees_insert on public.employees;
drop policy employees_update on public.employees;
drop policy employees_delete on public.employees;

create policy employees_insert on public.employees
for insert to authenticated
with check (
  (select private.org_role(org_id)) = 'owner'
  or (select private.is_manager(org_id))
  or (select private.has_capability(org_id, 'people_edit'))
);

create policy employees_update on public.employees
for update to authenticated
using ((select private.can_write_employee(id, org_id)))
with check ((select private.can_write_employee(id, org_id)));

create policy employees_delete on public.employees
for delete to authenticated
using ((select private.can_write_employee(id, org_id)));

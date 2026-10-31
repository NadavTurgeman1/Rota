-- A person is scheduled only when they work shifts.
-- A manager can belong to a site without being on its roster.
-- The company owner is not a site worker.

alter table public.employees
  add column schedulable boolean not null default true;

comment on column public.employees.schedulable is
  'When false, the person manages and is not placed on shifts or listed as a site worker.';

create table public.employee_permissions (
  org_id uuid not null,
  employee_id uuid not null,
  capability text not null,
  primary key (employee_id, capability),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  constraint employee_permissions_capability_check check (capability in (
    'clock', 'constraints', 'absences', 'trades', 'schedule_view', 'schedule_edit',
    'site_settings', 'people_site', 'people_edit', 'messages', 'insights', 'documents'
  ))
);

create index employee_permissions_employee_org_idx on public.employee_permissions (employee_id, org_id);
create index employee_permissions_org_id_idx on public.employee_permissions (org_id);

comment on table public.employee_permissions is
  'One row per permission granted to a person. Kept in step with employees.capabilities.';

create table public.employee_managed_sites (
  org_id uuid not null,
  employee_id uuid not null,
  site_id uuid not null,
  primary key (employee_id, site_id),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

create index employee_managed_sites_employee_org_idx on public.employee_managed_sites (employee_id, org_id);
create index employee_managed_sites_site_org_idx on public.employee_managed_sites (site_id, org_id);

comment on table public.employee_managed_sites is
  'Sites a person manages without working there. Working sites stay in employee_sites.';

update public.employees e
set schedulable = false
from public.memberships m
where m.org_id = e.org_id
  and m.user_id = e.user_id
  and m.role = 'owner';

update public.employees e
set schedulable = false
from public.memberships m
where m.org_id = e.org_id
  and m.user_id = e.user_id
  and m.role = 'manager'
  and not exists (select 1 from public.assignments a where a.employee_id = e.id);

delete from public.employee_sites es
using public.employees e
where es.employee_id = e.id
  and e.schedulable = false;

insert into public.employee_managed_sites (org_id, employee_id, site_id)
select e.org_id, e.id, sm.site_id
from public.employees e
join public.site_memberships sm
  on sm.org_id = e.org_id and sm.user_id = e.user_id and sm.role = 'manager'
where e.schedulable = false
on conflict do nothing;

insert into public.employee_permissions (org_id, employee_id, capability)
select e.org_id, e.id, item.key
from public.employees e
cross join lateral jsonb_each(e.capabilities) as item(key, val)
where item.val = 'true'::jsonb
  and item.key in (
    'clock', 'constraints', 'absences', 'trades', 'schedule_view', 'schedule_edit',
    'site_settings', 'people_site', 'people_edit', 'messages', 'insights', 'documents'
  )
on conflict do nothing;

create or replace function private.sync_employee_permissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.employee_permissions where employee_id = new.id;
  insert into public.employee_permissions (org_id, employee_id, capability)
  select new.org_id, new.id, item.key
  from jsonb_each(new.capabilities) as item(key, val)
  where item.val = 'true'::jsonb
    and item.key in (
      'clock', 'constraints', 'absences', 'trades', 'schedule_view', 'schedule_edit',
      'site_settings', 'people_site', 'people_edit', 'messages', 'insights', 'documents'
    );
  return new;
end;
$$;

create trigger employees_sync_permissions
after insert or update of capabilities on public.employees
for each row execute function private.sync_employee_permissions();

revoke all on function private.sync_employee_permissions() from public, anon, authenticated;

alter table public.employee_permissions enable row level security;
alter table public.employee_permissions force row level security;
alter table public.employee_managed_sites enable row level security;
alter table public.employee_managed_sites force row level security;

revoke all on public.employee_permissions from public, anon, authenticated;
revoke all on public.employee_managed_sites from public, anon, authenticated;
grant select, insert, update, delete on public.employee_permissions to authenticated;
grant select, insert, update, delete on public.employee_managed_sites to authenticated;

create policy employee_permissions_read on public.employee_permissions
for select to authenticated
using ((select private.employee_visible(employee_id, org_id)));

create policy employee_permissions_write on public.employee_permissions
for all to authenticated
using ((select private.can_write_employee(employee_id, org_id)))
with check ((select private.can_write_employee(employee_id, org_id)));

create policy employee_managed_sites_read on public.employee_managed_sites
for select to authenticated
using ((select private.employee_visible(employee_id, org_id)));

create policy employee_managed_sites_write on public.employee_managed_sites
for all to authenticated
using ((select private.can_write_employee(employee_id, org_id)))
with check ((select private.can_write_employee(employee_id, org_id)));

create table public.employee_profiles (
  employee_id uuid not null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  primary key (employee_id),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

comment on table public.employee_profiles is
  'Identity, address, employment dates, bank, and family status. Visible to managers only. Scheduling does not read this.';

alter table public.employee_profiles enable row level security;

create policy employee_profiles_manager on public.employee_profiles
for all to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

alter table public.employees drop column profile;

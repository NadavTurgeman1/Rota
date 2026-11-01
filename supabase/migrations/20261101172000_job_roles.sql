-- Role names a site offers, and the extra roles a person may fill by hand.

alter table public.sites
  add column roles jsonb;

alter table public.employees
  add column secondary_roles jsonb not null default '[]'::jsonb;

alter table public.sites
  drop constraint if exists sites_roles_array;

alter table public.sites
  add constraint sites_roles_array check (roles is null or jsonb_typeof(roles) = 'array');

alter table public.employees
  drop constraint if exists employees_secondary_roles_array;

alter table public.employees
  add constraint employees_secondary_roles_array check (jsonb_typeof(secondary_roles) = 'array');

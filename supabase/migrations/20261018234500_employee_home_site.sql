-- The primary site of a roster person. Other employee_sites links are reinforcement sites.
-- Null means it has not been chosen yet. A person linked to one site is at home there.

alter table public.employees
  add column home_site_id uuid references public.sites (id) on delete set null;

comment on column public.employees.home_site_id is
  'Primary site of this roster person. Other linked sites of the same business are reinforcement. Empty means not chosen yet.';

create or replace function private.employee_home_site_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.home_site_id is not null and not exists (
    select 1
    from public.sites site
    where site.id = new.home_site_id
      and site.org_id = new.org_id
  ) then
    raise exception 'home site belongs to another business';
  end if;
  return new;
end;
$$;

revoke all on function private.employee_home_site_same_org() from public, anon;
grant execute on function private.employee_home_site_same_org() to authenticated;

drop trigger if exists employees_home_site_same_org on public.employees;
create trigger employees_home_site_same_org
before insert or update of home_site_id, org_id on public.employees
for each row execute function private.employee_home_site_same_org();

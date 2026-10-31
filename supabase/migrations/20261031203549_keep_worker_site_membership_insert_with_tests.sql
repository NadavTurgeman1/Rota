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
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select new.org_id, ms.site_id, new.user_id, 'manager'
    from public.employee_managed_sites ms
    where ms.employee_id = new.id
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

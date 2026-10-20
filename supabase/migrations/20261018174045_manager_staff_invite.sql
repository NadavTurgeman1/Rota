-- A shift manager may open an employee login. They still cannot invite another shift manager.

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
  if not private.is_manager(target_org) then
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

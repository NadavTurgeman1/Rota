create or replace function private.constraint_window_open(target_site uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sites s
    cross join lateral (
      select date_trunc('minute', now() at time zone s.timezone) as local_time
    ) clock
    cross join lateral (
      select
        s.constraint_opens_day * 1440
          + extract(hour from s.constraint_opens)::int * 60
          + extract(minute from s.constraint_opens)::int as opens_at,
        s.constraint_closes_day * 1440
          + extract(hour from s.constraint_closes)::int * 60
          + extract(minute from s.constraint_closes)::int as closes_at,
        extract(dow from clock.local_time)::int * 1440
          + extract(hour from clock.local_time)::int * 60
          + extract(minute from clock.local_time)::int as now_at
    ) span
    where s.id = target_site
      and (
        s.constraint_extension_until > now()
        or (
          case
            when span.closes_at >= span.opens_at then span.now_at between span.opens_at and span.closes_at
            else span.now_at >= span.opens_at or span.now_at <= span.closes_at
          end
        )
      )
  );
$$;

update public.sites set staff_access = true where not staff_access;

create or replace function private.grant_site_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked uuid;
  lead boolean;
begin
  select user_id into linked from public.employees where id = new.employee_id and org_id = new.org_id;
  if linked is null then
    return new;
  end if;
  if exists (
    select 1 from public.memberships
    where org_id = new.org_id and user_id = linked and role = 'owner'
  ) then
    return new;
  end if;
  lead := private.employee_is_lead(new.employee_id);
  insert into public.site_memberships (org_id, site_id, user_id, role)
  values (
    new.org_id,
    new.site_id,
    linked,
    case when lead then 'manager' else 'employee' end
  )
  on conflict (site_id, user_id) do update
    set role = case
      when excluded.role = 'manager' then 'manager'
      else public.site_memberships.role
    end;
  if lead then
    insert into public.memberships (org_id, user_id, role)
    values (new.org_id, linked, 'manager')
    on conflict (org_id, user_id) do update
      set role = case
        when public.memberships.role = 'employee' then 'manager'
        else public.memberships.role
      end;
  end if;
  return new;
end;
$$;

create or replace function private.revoke_site_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked uuid;
begin
  select user_id into linked from public.employees where id = old.employee_id and org_id = old.org_id;
  if linked is null then
    return old;
  end if;
  if exists (
    select 1 from public.memberships
    where org_id = old.org_id and user_id = linked and role = 'owner'
  ) then
    return old;
  end if;
  if exists (
    select 1
    from public.employee_sites es
    join public.employees other on other.id = es.employee_id and other.org_id = es.org_id
    where other.user_id = linked and other.org_id = old.org_id and es.site_id = old.site_id
  ) or exists (
    select 1
    from public.employee_managed_sites ms
    join public.employees other on other.id = ms.employee_id and other.org_id = ms.org_id
    where other.user_id = linked and other.org_id = old.org_id and ms.site_id = old.site_id
  ) then
    return old;
  end if;
  delete from public.site_memberships
  where org_id = old.org_id and site_id = old.site_id and user_id = linked;
  return old;
end;
$$;

drop trigger if exists employee_sites_grant_login on public.employee_sites;
create trigger employee_sites_grant_login
after insert on public.employee_sites
for each row execute function private.grant_site_login();

drop trigger if exists employee_sites_revoke_login on public.employee_sites;
create trigger employee_sites_revoke_login
after delete on public.employee_sites
for each row execute function private.revoke_site_login();

drop trigger if exists employee_managed_sites_grant_login on public.employee_managed_sites;
create trigger employee_managed_sites_grant_login
after insert on public.employee_managed_sites
for each row execute function private.grant_site_login();

drop trigger if exists employee_managed_sites_revoke_login on public.employee_managed_sites;
create trigger employee_managed_sites_revoke_login
after delete on public.employee_managed_sites
for each row execute function private.revoke_site_login();

revoke all on function private.grant_site_login() from public, anon, authenticated;
revoke all on function private.revoke_site_login() from public, anon, authenticated;

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
  if not private.is_manager(target_org) and not private.has_capability(target_org, 'people_edit') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if cleaned_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or not exists (
       select 1 from public.employees where id = target_employee and org_id = target_org
     )
     or not (
       exists (select 1 from public.employee_sites where employee_id = target_employee and org_id = target_org)
       or exists (select 1 from public.employee_managed_sites where employee_id = target_employee and org_id = target_org)
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
    select 1 from public.founder_approvals
    where email = cleaned_email and consumed_at is null
  ) or exists (
    select 1 from public.employees
    where org_id = target_org and id <> target_employee and lower(email) = cleaned_email and email <> ''
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;

  select id into existing_user from auth.users where lower(email) = cleaned_email limit 1;
  if existing_user is not null then
    if exists (
      select 1 from public.memberships
      where org_id = target_org and user_id = existing_user and role = 'owner'
    ) or exists (
      select 1 from public.employees
      where org_id = target_org and user_id = existing_user and id <> target_employee
    ) then
      raise exception 'invitation is invalid' using errcode = '23514';
    end if;
    insert into public.memberships (org_id, user_id, role)
    values (target_org, existing_user, 'employee')
    on conflict (org_id, user_id) do nothing;
    update public.employees
    set user_id = existing_user, email = cleaned_email
    where id = target_employee and org_id = target_org and user_id is null;
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select target_org, es.site_id, existing_user,
      case when private.employee_is_lead(target_employee) then 'manager' else 'employee' end
    from public.employee_sites es
    where es.employee_id = target_employee and es.org_id = target_org
    on conflict (site_id, user_id) do update
      set role = case
        when excluded.role = 'manager' then 'manager'
        else public.site_memberships.role
      end;
    insert into public.site_memberships (org_id, site_id, user_id, role)
    select target_org, ms.site_id, existing_user, 'manager'
    from public.employee_managed_sites ms
    where ms.employee_id = target_employee and ms.org_id = target_org
    on conflict (site_id, user_id) do update set role = 'manager';
    if private.employee_is_lead(target_employee) then
      update public.memberships
      set role = 'manager'
      where org_id = target_org and user_id = existing_user and role = 'employee';
    end if;
    return 'linked';
  end if;

  update public.employees
  set email = cleaned_email
  where id = target_employee and org_id = target_org;
  return 'invited';
end;
$$;

create or replace function private.remove_staff_login(target_org uuid, target_employee uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_user uuid;
begin
  if not private.is_manager(target_org) and not private.has_capability(target_org, 'people_edit') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employees where id = target_employee and org_id = target_org) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  select user_id into linked_user
  from public.employees
  where id = target_employee and org_id = target_org;
  if linked_user is null then
    return true;
  end if;
  if exists (
    select 1 from public.memberships
    where org_id = target_org and user_id = linked_user and role = 'owner'
  ) then
    raise exception 'invitation is invalid' using errcode = '23514';
  end if;
  update public.employees set user_id = null where id = target_employee and org_id = target_org;
  if not exists (select 1 from public.employees where org_id = target_org and user_id = linked_user) then
    delete from public.site_memberships where org_id = target_org and user_id = linked_user;
    delete from public.memberships where org_id = target_org and user_id = linked_user and role <> 'owner';
  end if;
  perform private.drop_login_if_unused(linked_user);
  return true;
end;
$$;

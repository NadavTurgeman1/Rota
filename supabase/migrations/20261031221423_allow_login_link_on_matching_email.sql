create or replace function private.guard_employee_authority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid;
begin
  if tg_op = 'UPDATE'
     and old.user_id is null
     and new.user_id is not null
     and lower(new.email) = (select lower(email) from auth.users where id = new.user_id)
     and new.reports_to is not distinct from old.reports_to
     and new.opened_by is not distinct from old.opened_by
     and new.capabilities is not distinct from old.capabilities
  then
    return new;
  end if;
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

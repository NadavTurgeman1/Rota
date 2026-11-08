-- One delete removes a whole clock report: the clock-in and its clock-out together.
-- A report with only one of them is still one session.

create or replace function private.remove_attendance_session(
  target_employee uuid,
  first_punch uuid,
  second_punch uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  emp_org uuid;
  emp_user uuid;
  requested uuid[];
  open_id uuid := null;
  found boolean := false;
  rec record;
begin
  if first_punch is null then
    raise exception 'kind' using errcode = '22023';
  end if;
  requested := array[first_punch];
  if second_punch is not null and second_punch is distinct from first_punch then
    requested := requested || second_punch;
  end if;

  select e.org_id, e.user_id into emp_org, emp_user
  from public.employees e
  where e.id = target_employee
  for update;

  if emp_org is null
     or emp_user is not distinct from (select auth.uid())
     or not (
       (select private.org_role(emp_org)) = 'owner'
       or (select private.oversees(emp_org, target_employee))
     ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if (
    select count(*)
    from public.attendance_punches p
    where p.org_id = emp_org and p.employee_id = target_employee and p.id = any(requested)
  ) is distinct from cardinality(requested) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for rec in
    select p.id, p.kind
    from public.attendance_punches p
    where p.org_id = emp_org and p.employee_id = target_employee
    order by p.punched_at, p.id
  loop
    if rec.kind = 'in' then
      if open_id is not null
         and (select array_agg(u order by u) from unnest(array[open_id]) u)
             = (select array_agg(u order by u) from unnest(requested) u) then
        found := true;
      end if;
      open_id := rec.id;
    elsif open_id is not null then
      if (select array_agg(u order by u) from unnest(array[open_id, rec.id]) u)
         = (select array_agg(u order by u) from unnest(requested) u) then
        found := true;
      end if;
      open_id := null;
    elsif (select array_agg(u order by u) from unnest(array[rec.id]) u)
          = (select array_agg(u order by u) from unnest(requested) u) then
      found := true;
    end if;
  end loop;

  if open_id is not null
     and (select array_agg(u order by u) from unnest(array[open_id]) u)
         = (select array_agg(u order by u) from unnest(requested) u) then
    found := true;
  end if;

  if not found then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  delete from public.attendance_punches
  where org_id = emp_org and employee_id = target_employee and id = any(requested);
end;
$$;

revoke all on function private.remove_attendance_session(uuid, uuid, uuid) from public, anon;
grant execute on function private.remove_attendance_session(uuid, uuid, uuid) to authenticated;

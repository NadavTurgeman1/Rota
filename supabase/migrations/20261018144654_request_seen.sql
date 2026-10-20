-- An employee sees one notice when they next sign in after a shift manager answers.

alter table public.availability_requests
  add column acknowledged_at timestamptz;

create or replace function private.acknowledge_availability_request(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.availability_requests
    where id = target
      and acknowledged_at is not null
      and status in ('approved', 'rejected')
      and (select private.owns_employee(employee_id, org_id))
  ) then
    return;
  end if;

  update public.availability_requests
  set acknowledged_at = now()
  where id = target
    and acknowledged_at is null
    and status in ('approved', 'rejected')
    and (select private.owns_employee(employee_id, org_id));

  if not found then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.acknowledge_availability_request(target uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.acknowledge_availability_request(target);
$$;

revoke all on function private.acknowledge_availability_request(uuid) from public, anon;
revoke all on function public.acknowledge_availability_request(uuid) from public, anon;
grant execute on function private.acknowledge_availability_request(uuid) to authenticated;
grant execute on function public.acknowledge_availability_request(uuid) to authenticated;

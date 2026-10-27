create or replace function private.open_constraint_extension(target_site uuid, minutes integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  deadline timestamptz;
begin
  if minutes is null or minutes < 1 or minutes > 1439 then
    raise exception 'window';
  end if;
  update public.sites
  set constraint_extension_until = now() + make_interval(mins => minutes)
  where id = target_site
    and (select private.manages_site(target_site))
  returning constraint_extension_until into deadline;
  if deadline is null then
    raise exception 'forbidden';
  end if;
  return deadline;
end;
$$;

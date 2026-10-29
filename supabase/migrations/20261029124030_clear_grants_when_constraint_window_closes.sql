create or replace function private.close_constraint_extension(target_site uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.sites
  set constraint_extension_until = null
  where id = target_site
    and (select private.manages_site(target_site));
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'forbidden';
  end if;
  if not (select private.constraint_window_open(target_site)) then
    delete from public.constraint_grants where site_id = target_site;
  end if;
end;
$$;

create or replace function private.clear_closed_constraint_grants(target_site uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.manages_site(target_site)) then
    raise exception 'forbidden';
  end if;
  update public.sites
  set constraint_extension_until = null
  where id = target_site
    and constraint_extension_until is not null
    and constraint_extension_until <= now();
  if (select private.constraint_window_open(target_site)) then
    return;
  end if;
  delete from public.constraint_grants where site_id = target_site;
end;
$$;

revoke all on function private.clear_closed_constraint_grants(uuid) from public, anon;
grant execute on function private.clear_closed_constraint_grants(uuid) to authenticated;

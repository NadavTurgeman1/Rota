create or replace function public.set_login_password(target_email text, new_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned text := lower(btrim(coalesce(target_email, '')));
  account uuid;
begin
  if new_password is null or length(new_password) < 6 then
    return false;
  end if;
  if cleaned !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return false;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'encrypted_password'
  ) then
    return false;
  end if;
  select id into account from auth.users where lower(email) = cleaned limit 1;
  if account is null then
    return false;
  end if;
  execute 'update auth.users set encrypted_password = extensions.crypt($1, extensions.gen_salt(''bf'')) where id = $2'
    using new_password, account;
  return true;
end;
$$;

revoke all on function public.set_login_password(text, text) from public, anon;
grant execute on function public.set_login_password(text, text) to anon, authenticated;

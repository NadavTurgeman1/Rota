create or replace function private.confirm_new_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    execute 'update auth.users set email_confirmed_at = now() where id = $1 and email_confirmed_at is null' using new.id;
  end if;
  return new;
end;
$$;

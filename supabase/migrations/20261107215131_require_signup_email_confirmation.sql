-- New accounts stay unconfirmed until the person opens the verification email.
create or replace function private.confirm_new_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

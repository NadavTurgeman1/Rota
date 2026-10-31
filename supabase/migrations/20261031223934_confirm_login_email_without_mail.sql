create or replace function private.sync_account_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null or btrim(new.email) = '' then
    return new;
  end if;
  new.email := lower(btrim(new.email));
  if tg_op = 'UPDATE'
     and new.email is not distinct from old.email
     and new.user_id is not distinct from old.user_id
  then
    return new;
  end if;
  if exists (
    select 1 from auth.users
    where id <> new.user_id and lower(email) = new.email
  ) then
    raise exception 'invitation is invalid' using errcode = '23505';
  end if;
  update auth.users set email = new.email where id = new.user_id and lower(email) is distinct from new.email;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now()),
        email_change = '',
        email_change_token_new = '',
        email_change_token_current = '',
        email_change_confirm_status = 0,
        email_change_sent_at = null
    where id = new.user_id;
  end if;
  update public.profiles set email = new.email where user_id = new.user_id;
  return new;
end;
$$;

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
  ) and new.email_confirmed_at is null then
    update auth.users set email_confirmed_at = now() where id = new.id and email_confirmed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists confirm_new_login on auth.users;
create trigger confirm_new_login
after insert on auth.users
for each row execute function private.confirm_new_login();

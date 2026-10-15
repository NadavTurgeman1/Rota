-- Connect the app to the tables.
-- A site may store 0 for "no weekly cap" and "no extension cap".
-- Display names stay text, because the schedule shows a name rather than a user id.
-- Removing someone does not delete rows that a published week still references.

do $hours$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'sites'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%max_weekly_hours%';
  if constraint_name is not null then
    execute format('alter table public.sites drop constraint %I', constraint_name);
  end if;
  alter table public.sites
    add constraint sites_max_weekly_hours_nonnegative check (max_weekly_hours >= 0);

  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'sites'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%max_shift_hours%';
  if constraint_name is not null then
    execute format('alter table public.sites drop constraint %I', constraint_name);
  end if;
  alter table public.sites
    add constraint sites_max_shift_hours_nonnegative check (max_shift_hours >= 0);
end
$hours$;

alter table public.schedules
  add column restored_from integer check (restored_from > 0);

alter table public.schedule_versions
  add column author_name text not null default '';

alter table public.schedule_calloffs
  add column reported_by_name text not null default '';

do $keep_history$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'assignments'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) ilike '%employees%'
  loop
    execute format('alter table public.assignments drop constraint %I', constraint_name);
  end loop;
  alter table public.assignments
    add constraint assignments_employee_org_fkey
    foreign key (employee_id, org_id) references public.employees (id, org_id) on delete restrict;

  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'schedule_calloffs'
      and con.contype = 'f'
      and pg_get_constraintdef(con.oid) ilike '%employees%'
  loop
    execute format('alter table public.schedule_calloffs drop constraint %I', constraint_name);
  end loop;
  alter table public.schedule_calloffs
    add constraint schedule_calloffs_employee_org_fkey
    foreign key (employee_id, org_id) references public.employees (id, org_id) on delete restrict;
end
$keep_history$;

-- Names for people who share an organization. auth.users is not readable by authenticated.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default ''
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on table public.profiles from public, anon;
grant select, update (name) on table public.profiles to authenticated;

create policy profiles_read on public.profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profiles.user_id
  )
);

create policy profiles_update on public.profiles
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (user_id) do update
    set email = excluded.email;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

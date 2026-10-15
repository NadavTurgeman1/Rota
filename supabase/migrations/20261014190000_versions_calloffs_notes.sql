-- Phase 9: published versions, plus state that phases 6–8 kept only in the browser demo.
-- schedule_versions: frozen copies of a published week. Readable by managers only, never updated.
-- schedule_calloffs: who dropped out of a published week, when, and who reported it.
-- constraint_notes: approved free-text messages. They can hold personal reasons, so managers only.
-- sites.max_day_hours: daily hour cap. 0 keeps the prototype rule of no daily cap.

alter table public.sites
  add column max_day_hours numeric(4, 2) not null default 0 check (max_day_hours >= 0);

create table public.schedule_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  schedule_id uuid not null,
  number integer not null check (number > 0),
  reason text not null check (reason in ('publish', 'calloff')),
  restored_from integer check (restored_from > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  unique (schedule_id, number),
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade
);

create index schedule_versions_org_id_idx on public.schedule_versions (org_id);

create table public.schedule_calloffs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  schedule_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  employee_id uuid not null,
  reported_at timestamptz not null default now(),
  reported_by uuid default auth.uid(),
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

create index schedule_calloffs_org_id_idx on public.schedule_calloffs (org_id);
create index schedule_calloffs_schedule_id_idx on public.schedule_calloffs (schedule_id);

create table public.constraint_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  week_start date not null check (extract(dow from week_start) = 0),
  raw text not null check (length(raw) between 1 and 4000),
  employee_ids uuid[] not null default '{}',
  model_lines integer[] not null default '{}',
  approved_at timestamptz not null default now(),
  approved_by uuid default auth.uid(),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

create index constraint_notes_org_id_idx on public.constraint_notes (org_id);
create index constraint_notes_site_week_idx on public.constraint_notes (site_id, week_start);

do $new_tables$
declare
  table_name text;
begin
  foreach table_name in array array['schedule_versions', 'schedule_calloffs', 'constraint_notes']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on table public.%I from public, anon', table_name);
  end loop;
end
$new_tables$;

grant select, insert on table public.schedule_versions to authenticated;
grant select, insert, update, delete on table public.schedule_calloffs to authenticated;
grant select, insert, update, delete on table public.constraint_notes to authenticated;

create policy schedule_versions_read on public.schedule_versions
for select to authenticated
using ((select private.is_manager(org_id)));

create policy schedule_versions_insert on public.schedule_versions
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy schedule_calloffs_read on public.schedule_calloffs
for select to authenticated
using ((select private.schedule_visible(schedule_id, org_id)));

create policy schedule_calloffs_insert on public.schedule_calloffs
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy schedule_calloffs_update on public.schedule_calloffs
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy schedule_calloffs_delete on public.schedule_calloffs
for delete to authenticated
using ((select private.is_manager(org_id)));

create policy constraint_notes_all on public.constraint_notes
for all to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

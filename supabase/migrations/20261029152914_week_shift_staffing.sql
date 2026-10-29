create table public.schedule_staffing (
  org_id uuid not null,
  schedule_id uuid not null,
  shift_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  required_count integer not null check (required_count >= 0),
  primary key (schedule_id, shift_id, weekday),
  foreign key (schedule_id, org_id) references public.schedules (id, org_id) on delete cascade,
  foreign key (shift_id, org_id) references public.shifts (id, org_id) on delete cascade
);

comment on table public.schedule_staffing is
  'Headcount for one shift on one week. A missing row uses the standing shift requirement.';

create index schedule_staffing_org_id_idx on public.schedule_staffing (org_id);
create index schedule_staffing_shift_idx on public.schedule_staffing (shift_id, org_id);

alter table public.schedule_staffing enable row level security;
alter table public.schedule_staffing force row level security;

revoke all on table public.schedule_staffing from public, anon, authenticated;
grant select, insert, update, delete on table public.schedule_staffing to authenticated;

create policy schedule_staffing_read on public.schedule_staffing
for select to authenticated
using ((select private.schedule_visible(schedule_id, org_id)));

create policy schedule_staffing_insert on public.schedule_staffing
for insert to authenticated
with check ((select private.is_manager(org_id)));

create policy schedule_staffing_update on public.schedule_staffing
for update to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

create policy schedule_staffing_delete on public.schedule_staffing
for delete to authenticated
using ((select private.is_manager(org_id)));

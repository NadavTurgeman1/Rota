-- Sick leave, vacation, and other absences. An employee files a range with
-- optional documents. A manager of the site approves. Approved days block
-- scheduling and are not counted as weekly constraint blocks.

create table public.absence_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  site_id uuid not null,
  employee_id uuid not null,
  kind text not null check (kind in ('sick', 'vacation', 'other')),
  start_date date not null,
  end_date date not null,
  note text not null default '' check (char_length(note) <= 2000),
  status text not null default 'open'
    check (status in ('open', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (id, org_id),
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  check (end_date >= start_date),
  check (end_date <= start_date + 120)
);

comment on table public.absence_requests is
  'A sick, vacation, or other absence range. Scheduling reads approved rows only.';

create table public.absence_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  site_id uuid not null,
  request_id uuid not null,
  employee_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 180),
  content_type text not null check (char_length(content_type) between 1 and 120),
  byte_size integer not null check (byte_size between 1 and 8388608),
  body bytea not null check (octet_length(body) = byte_size),
  created_at timestamptz not null default now(),
  foreign key (request_id, org_id) references public.absence_requests (id, org_id) on delete cascade,
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade,
  foreign key (site_id, org_id) references public.sites (id, org_id) on delete cascade
);

comment on table public.absence_documents is
  'Proof files on an absence request. Visible to the employee and to managers of the site.';

create index absence_requests_org_id_idx on public.absence_requests (org_id);
create index absence_requests_site_org_idx on public.absence_requests (site_id, org_id);
create index absence_requests_employee_org_idx on public.absence_requests (employee_id, org_id);
create index absence_requests_status_dates_idx on public.absence_requests (status, start_date, end_date);
create index absence_documents_org_id_idx on public.absence_documents (org_id);
create index absence_documents_site_org_idx on public.absence_documents (site_id, org_id);
create index absence_documents_request_org_idx on public.absence_documents (request_id, org_id);
create index absence_documents_employee_org_idx on public.absence_documents (employee_id, org_id);

alter table public.absence_requests enable row level security;
alter table public.absence_requests force row level security;
alter table public.absence_documents enable row level security;
alter table public.absence_documents force row level security;

revoke all on table public.absence_requests from public, anon, authenticated;
revoke all on table public.absence_documents from public, anon, authenticated;
grant select, insert, delete on table public.absence_requests to authenticated;
grant select, insert, delete on table public.absence_documents to authenticated;

create policy absence_requests_manager on public.absence_requests
for all to authenticated
using ((select private.manages_site(site_id)))
with check ((select private.manages_site(site_id)));

create policy absence_requests_employee on public.absence_requests
for select to authenticated
using ((select private.owns_employee(employee_id, org_id)));

create policy absence_requests_employee_insert on public.absence_requests
for insert to authenticated
with check (
  (select private.owns_employee(employee_id, org_id))
  and exists (
    select 1
    from public.employee_sites es
    where es.employee_id = absence_requests.employee_id
      and es.site_id = absence_requests.site_id
      and es.org_id = absence_requests.org_id
  )
);

create policy absence_requests_employee_delete on public.absence_requests
for delete to authenticated
using (
  status = 'open'
  and (select private.owns_employee(employee_id, org_id))
);

create policy absence_documents_manager on public.absence_documents
for all to authenticated
using ((select private.manages_site(site_id)))
with check ((select private.manages_site(site_id)));

create policy absence_documents_employee on public.absence_documents
for select to authenticated
using ((select private.owns_employee(employee_id, org_id)));

create policy absence_documents_employee_insert on public.absence_documents
for insert to authenticated
with check (
  (select private.owns_employee(employee_id, org_id))
  and exists (
    select 1
    from public.absence_requests r
    where r.id = request_id
      and r.org_id = org_id
      and r.employee_id = employee_id
      and r.site_id = site_id
      and r.status = 'open'
  )
);

create or replace function public.decide_absence_request(target uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.absence_requests r
  set
    status = case when approve then 'approved' else 'rejected' end,
    decided_at = now(),
    decided_by = (select auth.uid())
  where r.id = target
    and r.status = 'open'
    and (select private.manages_site(r.site_id));
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.decide_absence_request(uuid, boolean) from public, anon;
grant execute on function public.decide_absence_request(uuid, boolean) to authenticated;

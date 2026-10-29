create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  employee_id uuid not null,
  file_name text not null check (char_length(file_name) between 1 and 180),
  content_type text not null check (char_length(content_type) between 1 and 120),
  byte_size integer not null check (byte_size between 1 and 8388608),
  body bytea not null check (octet_length(body) = byte_size),
  created_at timestamptz not null default now(),
  foreign key (employee_id, org_id) references public.employees (id, org_id) on delete cascade
);

comment on table public.employee_documents is
  'Forms and documents kept on an employee. Visible to managers only. Scheduling does not read this.';

create index employee_documents_org_id_idx on public.employee_documents (org_id);
create index employee_documents_employee_org_idx on public.employee_documents (employee_id, org_id);
create index employee_documents_employee_created_idx on public.employee_documents (employee_id, created_at desc);

alter table public.employee_documents enable row level security;

create policy employee_documents_manager on public.employee_documents
for all to authenticated
using ((select private.is_manager(org_id)))
with check ((select private.is_manager(org_id)));

revoke all on table public.employee_documents from anon;
grant select, insert, update, delete on table public.employee_documents to authenticated;

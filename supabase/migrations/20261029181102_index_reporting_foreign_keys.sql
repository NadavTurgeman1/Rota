create index employees_reports_to_org_id_idx on public.employees (reports_to, org_id);
create index employees_opened_by_org_id_idx on public.employees (opened_by, org_id);
create index schedule_staffing_schedule_org_idx on public.schedule_staffing (schedule_id, org_id);

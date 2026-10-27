create index employee_profiles_org_id_idx on public.employee_profiles (org_id);
create index employee_profiles_employee_org_idx on public.employee_profiles (employee_id, org_id);

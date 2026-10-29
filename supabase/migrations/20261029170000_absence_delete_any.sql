-- A filed absence can be deleted after approval, not only while it is still open.

drop policy if exists absence_requests_employee_delete on public.absence_requests;
create policy absence_requests_employee_delete on public.absence_requests
for delete to authenticated
using ((select private.owns_employee(employee_id, org_id)));

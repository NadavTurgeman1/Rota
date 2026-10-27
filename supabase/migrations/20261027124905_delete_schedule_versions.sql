-- Managers can remove a frozen schedule version. Updates stay closed.

grant delete on table public.schedule_versions to authenticated;

create policy schedule_versions_delete on public.schedule_versions
for delete to authenticated
using ((select private.is_manager(org_id)));

-- INSERT ... ON CONFLICT and RETURNING check the select policy before the new
-- row can be read back. Managers may see every status, so that decision must
-- not depend on finding the row. Employees still see published weeks only.
create or replace function private.schedule_visible(target_schedule uuid, target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.org_role(target_org) is not null
     and (
       private.is_manager(target_org)
       or exists (
         select 1
         from public.schedules
         where id = target_schedule
           and org_id = target_org
           and status = 'published'
       )
     );
$$;

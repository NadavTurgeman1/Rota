-- Read the support setting once per query, in the form the Supabase linter recognizes.

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.org_id = mine.org_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.user_id
  )
  or (
    (select private.is_platform_admin())
    and exists (
      select 1
      from public.memberships member
      where member.user_id = profiles.user_id
        and member.org_id::text = nullif((select current_setting('app.support_org', true)), '')
    )
  )
);

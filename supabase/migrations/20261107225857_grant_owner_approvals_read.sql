-- The public wrapper runs as the signed-in user, so that user needs permission to call the private list.
grant execute on function private.list_owner_approvals() to authenticated;

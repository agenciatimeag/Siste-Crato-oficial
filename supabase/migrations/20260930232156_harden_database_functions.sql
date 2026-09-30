create schema if not exists private;

alter function public.set_updated_at() set search_path = public;

alter function public.is_workspace_member(uuid) set schema private;
alter function public.has_workspace_role(uuid, text[]) set schema private;
alter function public.can_view_profile(uuid) set schema private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

revoke all on function private.is_workspace_member(uuid) from public;
revoke all on function private.has_workspace_role(uuid, text[]) from public;
revoke all on function private.can_view_profile(uuid) from public;

grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
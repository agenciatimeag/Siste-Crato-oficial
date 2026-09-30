alter table public.workspaces
  add column created_by_user_id uuid not null default auth.uid()
    references auth.users(id) on delete restrict;

create index workspaces_created_by_idx on public.workspaces(created_by_user_id);

create or replace function private.can_bootstrap_workspace(target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()
    and exists (
      select 1
      from public.workspaces w
      where w.id = target_workspace_id
        and w.created_by_user_id = target_user_id
        and not exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = target_workspace_id
        )
    );
$$;

revoke all on function private.can_bootstrap_workspace(uuid, uuid) from public;
grant execute on function private.can_bootstrap_workspace(uuid, uuid) to authenticated;

create policy workspaces_insert_authenticated on public.workspaces
for insert to authenticated
with check (created_by_user_id = (select auth.uid()));

drop policy workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin_or_bootstrap on public.workspace_members
for insert to authenticated
with check (
  private.has_workspace_role(workspace_id, array['owner','admin'])
  or (
    user_id = (select auth.uid())
    and role = 'owner'
    and private.can_bootstrap_workspace(workspace_id, user_id)
  )
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'Usuário'),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
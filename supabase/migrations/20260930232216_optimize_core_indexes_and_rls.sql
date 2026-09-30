create index activity_log_workspace_actor_idx on public.activity_log(workspace_id, actor_member_id);
create index client_contacts_workspace_client_idx on public.client_contacts(workspace_id, client_id);
create index clients_workspace_account_manager_idx on public.clients(workspace_id, account_manager_member_id);
create index contract_billing_workspace_contract_idx on public.contract_billing_terms(workspace_id, contract_id);
create index contract_templates_workspace_creator_idx on public.contract_templates(workspace_id, created_by_member_id);
create index contracts_workspace_client_idx on public.contracts(workspace_id, client_id);
create index contracts_workspace_template_idx on public.contracts(workspace_id, template_id);
create index project_files_workspace_project_idx on public.project_files(workspace_id, project_id);
create index project_files_workspace_uploader_idx on public.project_files(workspace_id, uploaded_by_member_id);
create index project_members_workspace_project_idx on public.project_members(workspace_id, project_id);
create index project_members_workspace_member_idx on public.project_members(workspace_id, member_id);
create index projects_workspace_client_idx on public.projects(workspace_id, client_id);
create index projects_workspace_owner_idx on public.projects(workspace_id, owner_member_id);

drop policy profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));
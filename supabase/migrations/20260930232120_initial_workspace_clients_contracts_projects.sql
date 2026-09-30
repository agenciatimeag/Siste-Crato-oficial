create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id),
  unique (workspace_id, id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  display_name text not null,
  legal_name text,
  trade_name text,
  cnpj text,
  phone text,
  email text,
  status text not null default 'active' check (status in ('active', 'paused', 'inactive')),
  account_manager_member_id uuid,
  notes text,
  joined_on date not null default current_date,
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint clients_cnpj_digits check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  constraint clients_dates_check check (ended_on is null or ended_on >= joined_on),
  constraint clients_account_manager_fk foreign key (workspace_id, account_manager_member_id)
    references public.workspace_members(workspace_id, id) on delete set null
);

create unique index clients_workspace_cnpj_unique
  on public.clients(workspace_id, cnpj)
  where cnpj is not null;

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  name text not null,
  role_title text,
  email text,
  phone text,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_contacts_client_fk foreign key (workspace_id, client_id)
    references public.clients(workspace_id, id) on delete restrict
);

create unique index client_contacts_one_primary_per_client
  on public.client_contacts(client_id)
  where is_primary = true;

create table public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null,
  description text,
  body_json jsonb not null default '{}'::jsonb,
  body_text text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint contract_templates_creator_fk foreign key (workspace_id, created_by_member_id)
    references public.workspace_members(workspace_id, id) on delete set null
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  template_id uuid,
  title text not null,
  code text,
  source_type text not null default 'manual' check (source_type in ('template', 'manual', 'upload')),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended', 'cancelled')),
  body_json jsonb not null default '{}'::jsonb,
  body_text text,
  start_date date,
  end_date date,
  signed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint contracts_client_fk foreign key (workspace_id, client_id)
    references public.clients(workspace_id, id) on delete restrict,
  constraint contracts_template_fk foreign key (workspace_id, template_id)
    references public.contract_templates(workspace_id, id) on delete set null,
  constraint contracts_dates_check check (end_date is null or start_date is null or end_date >= start_date),
  constraint contracts_template_source_check check (source_type <> 'template' or template_id is not null)
);

create table public.contract_billing_terms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  contract_id uuid not null,
  billing_mode text not null check (billing_mode in ('recurring', 'upfront', 'installment')),
  currency text not null default 'BRL' check (currency = 'BRL'),
  total_amount_cents bigint check (total_amount_cents is null or total_amount_cents >= 0),
  recurring_amount_cents bigint check (recurring_amount_cents is null or recurring_amount_cents >= 0),
  installment_amount_cents bigint check (installment_amount_cents is null or installment_amount_cents >= 0),
  installment_count integer check (installment_count is null or installment_count > 0),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  first_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id),
  constraint contract_billing_contract_fk foreign key (workspace_id, contract_id)
    references public.contracts(workspace_id, id) on delete cascade,
  constraint contract_billing_shape_check check (
    (billing_mode = 'recurring' and recurring_amount_cents is not null and due_day is not null)
    or
    (billing_mode = 'upfront' and total_amount_cents is not null and first_due_date is not null)
    or
    (billing_mode = 'installment' and total_amount_cents is not null and installment_count is not null and first_due_date is not null)
  )
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  client_id uuid not null,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  start_date date not null default current_date,
  planned_end_date date,
  completed_at timestamptz,
  owner_member_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint projects_client_fk foreign key (workspace_id, client_id)
    references public.clients(workspace_id, id) on delete restrict,
  constraint projects_owner_fk foreign key (workspace_id, owner_member_id)
    references public.workspace_members(workspace_id, id) on delete set null,
  constraint projects_dates_check check (planned_end_date is null or planned_end_date >= start_date)
);

create table public.project_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  member_id uuid not null,
  role_label text,
  is_lead boolean not null default false,
  created_at timestamptz not null default now(),
  unique (project_id, member_id),
  constraint project_members_project_fk foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id) on delete cascade,
  constraint project_members_member_fk foreign key (workspace_id, member_id)
    references public.workspace_members(workspace_id, id) on delete restrict
);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  source_type text not null default 'upload' check (source_type in ('upload', 'link')),
  file_name text not null,
  storage_path text,
  external_url text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  description text,
  uploaded_by_member_id uuid,
  created_at timestamptz not null default now(),
  constraint project_files_project_fk foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id) on delete cascade,
  constraint project_files_uploader_fk foreign key (workspace_id, uploaded_by_member_id)
    references public.workspace_members(workspace_id, id) on delete set null,
  constraint project_files_source_check check (
    (source_type = 'upload' and storage_path is not null and external_url is null)
    or
    (source_type = 'link' and external_url is not null and storage_path is null)
  )
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  entity_type text not null check (entity_type in ('client', 'contract', 'project')),
  entity_id uuid not null,
  action text not null,
  actor_member_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_log_actor_fk foreign key (workspace_id, actor_member_id)
    references public.workspace_members(workspace_id, id) on delete set null
);

create index workspace_members_user_idx on public.workspace_members(user_id);
create index clients_workspace_status_idx on public.clients(workspace_id, status);
create index client_contacts_client_idx on public.client_contacts(client_id);
create index contracts_client_status_idx on public.contracts(client_id, status);
create index contracts_end_date_idx on public.contracts(workspace_id, end_date) where end_date is not null;
create index projects_client_status_idx on public.projects(client_id, status);
create index project_members_member_idx on public.project_members(member_id);
create index project_files_project_idx on public.project_files(project_id);
create index activity_log_entity_idx on public.activity_log(workspace_id, entity_type, entity_id, created_at desc);

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger workspace_members_set_updated_at before update on public.workspace_members
for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients
for each row execute function public.set_updated_at();
create trigger client_contacts_set_updated_at before update on public.client_contacts
for each row execute function public.set_updated_at();
create trigger contract_templates_set_updated_at before update on public.contract_templates
for each row execute function public.set_updated_at();
create trigger contracts_set_updated_at before update on public.contracts
for each row execute function public.set_updated_at();
create trigger contract_billing_terms_set_updated_at before update on public.contract_billing_terms
for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
      and wm.role = any(allowed_roles)
  );
$$;

create or replace function public.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs
        on theirs.workspace_id = mine.workspace_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = target_user_id
        and theirs.status = 'active'
    );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.has_workspace_role(uuid, text[]) from public;
revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.has_workspace_role(uuid, text[]) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_billing_terms enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_files enable row level security;
alter table public.activity_log enable row level security;

create policy workspaces_select_member on public.workspaces
for select to authenticated
using (public.is_workspace_member(id));

create policy workspaces_update_admin on public.workspaces
for update to authenticated
using (public.has_workspace_role(id, array['owner','admin']))
with check (public.has_workspace_role(id, array['owner','admin']));

create policy profiles_select_workspace on public.profiles
for select to authenticated
using (public.can_view_profile(id));

create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy workspace_members_select_member on public.workspace_members
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy workspace_members_insert_admin on public.workspace_members
for insert to authenticated
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

create policy workspace_members_update_admin on public.workspace_members
for update to authenticated
using (public.has_workspace_role(workspace_id, array['owner','admin']))
with check (public.has_workspace_role(workspace_id, array['owner','admin']));

create policy clients_select_member on public.clients
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy clients_insert_member on public.clients
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy clients_update_member on public.clients
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy client_contacts_select_member on public.client_contacts
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy client_contacts_insert_member on public.client_contacts
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy client_contacts_update_member on public.client_contacts
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy client_contacts_delete_member on public.client_contacts
for delete to authenticated
using (public.is_workspace_member(workspace_id));

create policy contract_templates_select_member on public.contract_templates
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy contract_templates_insert_member on public.contract_templates
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy contract_templates_update_member on public.contract_templates
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy contracts_select_member on public.contracts
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy contracts_insert_member on public.contracts
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy contracts_update_member on public.contracts
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy contract_billing_select_member on public.contract_billing_terms
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy contract_billing_insert_member on public.contract_billing_terms
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy contract_billing_update_member on public.contract_billing_terms
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy projects_select_member on public.projects
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy projects_insert_member on public.projects
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy projects_update_member on public.projects
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy project_members_select_member on public.project_members
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy project_members_insert_member on public.project_members
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy project_members_update_member on public.project_members
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy project_members_delete_member on public.project_members
for delete to authenticated
using (public.is_workspace_member(workspace_id));

create policy project_files_select_member on public.project_files
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy project_files_insert_member on public.project_files
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
create policy project_files_update_member on public.project_files
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
create policy project_files_delete_member on public.project_files
for delete to authenticated
using (public.is_workspace_member(workspace_id));

create policy activity_log_select_member on public.activity_log
for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy activity_log_insert_member on public.activity_log
for insert to authenticated
with check (public.is_workspace_member(workspace_id));
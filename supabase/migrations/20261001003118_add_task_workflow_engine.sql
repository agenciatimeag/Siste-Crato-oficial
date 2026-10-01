create table public.task_types (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (workspace_id, name)
);

create table public.task_type_departments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_type_id uuid not null,
  department_id uuid not null,
  position integer not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (task_type_id, department_id),
  unique (task_type_id, position),
  constraint task_type_departments_task_type_fk foreign key (workspace_id, task_type_id)
    references public.task_types(workspace_id, id) on delete cascade,
  constraint task_type_departments_department_fk foreign key (workspace_id, department_id)
    references public.departments(workspace_id, id) on delete restrict
);

create table public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_type_department_id uuid not null,
  name text not null,
  position integer not null check (position > 0),
  operational_nature text not null default 'todo'
    check (operational_nature in ('todo', 'in_progress', 'waiting', 'done', 'complete')),
  is_internal_review boolean not null default false,
  is_external_review boolean not null default false,
  is_revision boolean not null default false,
  starts_timesheet boolean not null default false,
  stops_timesheet boolean not null default false,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (task_type_department_id, position),
  unique (task_type_department_id, name),
  constraint workflow_steps_task_type_department_fk foreign key (workspace_id, task_type_department_id)
    references public.task_type_departments(workspace_id, id) on delete cascade
);

create index task_types_workspace_active_idx
  on public.task_types(workspace_id, is_active);
create index departments_workspace_active_idx
  on public.departments(workspace_id, is_active);
create index task_type_departments_workspace_task_type_idx
  on public.task_type_departments(workspace_id, task_type_id, position);
create index task_type_departments_workspace_department_idx
  on public.task_type_departments(workspace_id, department_id);
create index workflow_steps_workspace_ttd_idx
  on public.workflow_steps(workspace_id, task_type_department_id, position);
create index workflow_steps_operational_nature_idx
  on public.workflow_steps(workspace_id, operational_nature);

create trigger task_types_set_updated_at before update on public.task_types
for each row execute function public.set_updated_at();
create trigger departments_set_updated_at before update on public.departments
for each row execute function public.set_updated_at();
create trigger task_type_departments_set_updated_at before update on public.task_type_departments
for each row execute function public.set_updated_at();
create trigger workflow_steps_set_updated_at before update on public.workflow_steps
for each row execute function public.set_updated_at();

alter table public.task_types enable row level security;
alter table public.departments enable row level security;
alter table public.task_type_departments enable row level security;
alter table public.workflow_steps enable row level security;

create policy task_types_select_member on public.task_types
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy task_types_insert_member on public.task_types
for insert to authenticated
with check (private.is_workspace_member(workspace_id));
create policy task_types_update_member on public.task_types
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

create policy departments_select_member on public.departments
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy departments_insert_member on public.departments
for insert to authenticated
with check (private.is_workspace_member(workspace_id));
create policy departments_update_member on public.departments
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

create policy task_type_departments_select_member on public.task_type_departments
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy task_type_departments_insert_member on public.task_type_departments
for insert to authenticated
with check (private.is_workspace_member(workspace_id));
create policy task_type_departments_update_member on public.task_type_departments
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy task_type_departments_delete_member on public.task_type_departments
for delete to authenticated
using (private.is_workspace_member(workspace_id));

create policy workflow_steps_select_member on public.workflow_steps
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy workflow_steps_insert_member on public.workflow_steps
for insert to authenticated
with check (private.is_workspace_member(workspace_id));
create policy workflow_steps_update_member on public.workflow_steps
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));
create policy workflow_steps_delete_member on public.workflow_steps
for delete to authenticated
using (private.is_workspace_member(workspace_id));

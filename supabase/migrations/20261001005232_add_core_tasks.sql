create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null,
  task_type_id uuid not null,
  workflow_step_id uuid not null,
  parent_task_id uuid,
  title text not null,
  briefing text,
  final_copy text,
  priority text not null default 'low' check (priority in ('low', 'medium', 'high')),
  assignee_member_id uuid,
  reviewer_member_id uuid,
  start_date date,
  due_date date,
  publication_date date,
  sort_order bigint not null default 0,
  completed_at timestamptz,
  archived_at timestamptz,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint tasks_title_not_blank check (length(btrim(title)) > 0),
  constraint tasks_dates_check check (due_date is null or start_date is null or due_date >= start_date),
  constraint tasks_publication_date_check check (publication_date is null or due_date is null or publication_date >= due_date),
  constraint tasks_project_fk foreign key (workspace_id, project_id)
    references public.projects(workspace_id, id) on delete restrict,
  constraint tasks_task_type_fk foreign key (workspace_id, task_type_id)
    references public.task_types(workspace_id, id) on delete restrict,
  constraint tasks_workflow_step_fk foreign key (workspace_id, workflow_step_id)
    references public.workflow_steps(workspace_id, id) on delete restrict,
  constraint tasks_assignee_fk foreign key (workspace_id, assignee_member_id)
    references public.workspace_members(workspace_id, id) on delete set null,
  constraint tasks_reviewer_fk foreign key (workspace_id, reviewer_member_id)
    references public.workspace_members(workspace_id, id) on delete set null,
  constraint tasks_created_by_fk foreign key (workspace_id, created_by_member_id)
    references public.workspace_members(workspace_id, id) on delete set null,
  constraint tasks_parent_fk foreign key (workspace_id, parent_task_id)
    references public.tasks(workspace_id, id) on delete restrict
);

create index tasks_workspace_project_idx
  on public.tasks(workspace_id, project_id, archived_at);
create index tasks_workspace_step_idx
  on public.tasks(workspace_id, workflow_step_id, archived_at);
create index tasks_workspace_type_idx
  on public.tasks(workspace_id, task_type_id, archived_at);
create index tasks_workspace_assignee_idx
  on public.tasks(workspace_id, assignee_member_id, archived_at);
create index tasks_workspace_reviewer_idx
  on public.tasks(workspace_id, reviewer_member_id, archived_at);
create index tasks_workspace_due_idx
  on public.tasks(workspace_id, due_date)
  where due_date is not null and archived_at is null;
create index tasks_workspace_publication_idx
  on public.tasks(workspace_id, publication_date)
  where publication_date is not null and archived_at is null;
create index tasks_parent_idx
  on public.tasks(workspace_id, parent_task_id)
  where parent_task_id is not null;

create or replace function private.validate_task_integrity()
returns trigger
language plpgsql
set search_path = public, private
as $$
declare
  resolved_task_type_id uuid;
  parent_project_id uuid;
  step_nature text;
begin
  select ttd.task_type_id, ws.operational_nature
    into resolved_task_type_id, step_nature
  from public.workflow_steps ws
  join public.task_type_departments ttd
    on ttd.workspace_id = ws.workspace_id
   and ttd.id = ws.task_type_department_id
  where ws.workspace_id = new.workspace_id
    and ws.id = new.workflow_step_id;

  if resolved_task_type_id is null then
    raise exception using
      errcode = '23514',
      message = 'INVALID_WORKFLOW_STEP';
  end if;

  if resolved_task_type_id <> new.task_type_id then
    raise exception using
      errcode = '23514',
      message = 'INVALID_WORKFLOW_POSITION';
  end if;

  if new.parent_task_id is not null then
    if new.parent_task_id = new.id then
      raise exception using
        errcode = '23514',
        message = 'TASK_CANNOT_PARENT_ITSELF';
    end if;

    select t.project_id
      into parent_project_id
    from public.tasks t
    where t.workspace_id = new.workspace_id
      and t.id = new.parent_task_id;

    if parent_project_id is null then
      raise exception using
        errcode = '23503',
        message = 'PARENT_TASK_NOT_FOUND';
    end if;

    if parent_project_id <> new.project_id then
      raise exception using
        errcode = '23514',
        message = 'PARENT_TASK_MUST_SHARE_PROJECT';
    end if;

    if exists (
      with recursive ancestors as (
        select t.id, t.parent_task_id
        from public.tasks t
        where t.workspace_id = new.workspace_id
          and t.id = new.parent_task_id
        union all
        select t.id, t.parent_task_id
        from public.tasks t
        join ancestors a on t.id = a.parent_task_id
        where t.workspace_id = new.workspace_id
          and a.parent_task_id is not null
      )
      select 1
      from ancestors
      where id = new.id
    ) then
      raise exception using
        errcode = '23514',
        message = 'TASK_PARENT_CYCLE';
    end if;
  end if;

  if step_nature = 'complete' then
    if old is null or old.workflow_step_id is distinct from new.workflow_step_id then
      new.completed_at = coalesce(new.completed_at, now());
    end if;
  elsif old is null or old.workflow_step_id is distinct from new.workflow_step_id then
    new.completed_at = null;
  end if;

  return new;
end;
$$;

create trigger tasks_validate_integrity
before insert or update of workspace_id, project_id, task_type_id, workflow_step_id, parent_task_id
on public.tasks
for each row execute function private.validate_task_integrity();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy tasks_select_member on public.tasks
for select to authenticated
using (private.is_workspace_member(workspace_id));

create policy tasks_insert_member on public.tasks
for insert to authenticated
with check (private.is_workspace_member(workspace_id));

create policy tasks_update_member on public.tasks
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

alter table public.activity_log
  drop constraint if exists activity_log_entity_type_check;

alter table public.activity_log
  add constraint activity_log_entity_type_check
  check (entity_type in ('client', 'contract', 'project', 'task'));

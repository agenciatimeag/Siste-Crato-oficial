create sequence if not exists private.tasks_task_number_seq
  as bigint
  start with 1
  increment by 1
  no cycle;

revoke all on sequence private.tasks_task_number_seq from public, anon, authenticated;

create table public.sprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint sprints_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);

alter table public.tasks
  add column task_number bigint,
  add column execution_date date,
  add column sprint_id uuid;

update public.tasks as task
set task_number = nextval('private.tasks_task_number_seq'::regclass)
where task.task_number is null;

alter table public.tasks
  alter column task_number set not null,
  add constraint tasks_workspace_task_number_unique unique (workspace_id, task_number),
  add constraint tasks_sprint_fk foreign key (workspace_id, sprint_id)
    references public.sprints(workspace_id, id) on delete restrict,
  add constraint tasks_execution_date_check
    check (execution_date is null or start_date is null or execution_date >= start_date),
  add constraint tasks_due_execution_date_check
    check (due_date is null or execution_date is null or due_date >= execution_date);

create or replace function private.assign_and_protect_task_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'INSERT' then
    if new.task_number is not null then
      raise exception using
        errcode = '23514',
        message = 'TASK_NUMBER_CANNOT_BE_PROVIDED';
    end if;

    new.task_number = nextval('private.tasks_task_number_seq'::regclass);
    return new;
  end if;

  if new.task_number is distinct from old.task_number then
    raise exception using
      errcode = '23514',
      message = 'TASK_NUMBER_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function private.assign_and_protect_task_number() from public, anon, authenticated;

create trigger tasks_assign_and_protect_task_number
before insert or update of task_number on public.tasks
for each row execute function private.assign_and_protect_task_number();

create index sprints_workspace_active_idx on public.sprints(workspace_id, is_active);
create index tasks_workspace_execution_idx
  on public.tasks(workspace_id, execution_date, sort_order)
  where execution_date is not null and archived_at is null;
create index tasks_workspace_sprint_idx
  on public.tasks(workspace_id, sprint_id, archived_at);
create index tasks_workspace_number_idx on public.tasks(workspace_id, task_number);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  title text not null check (length(btrim(title)) > 0),
  position integer not null check (position > 0),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_by_member_id uuid,
  completed_by_member_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (task_id, position),
  constraint task_checklist_task_fk foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  constraint task_checklist_creator_fk foreign key (workspace_id, created_by_member_id)
    references public.workspace_members(workspace_id, id) on delete set null (created_by_member_id),
  constraint task_checklist_completer_fk foreign key (workspace_id, completed_by_member_id)
    references public.workspace_members(workspace_id, id) on delete set null (completed_by_member_id),
  constraint task_checklist_completion_check check (
    (is_completed and completed_at is not null)
    or (not is_completed and completed_at is null and completed_by_member_id is null)
  )
);

create index task_checklist_workspace_task_position_idx
  on public.task_checklist_items(workspace_id, task_id, position);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  author_member_id uuid not null,
  body text not null check (length(btrim(body)) > 0),
  reply_to_comment_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (workspace_id, id),
  unique (workspace_id, task_id, id),
  constraint task_comments_task_fk foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  constraint task_comments_author_fk foreign key (workspace_id, author_member_id)
    references public.workspace_members(workspace_id, id) on delete restrict,
  constraint task_comments_reply_fk foreign key (workspace_id, task_id, reply_to_comment_id)
    references public.task_comments(workspace_id, task_id, id) on delete restrict,
  constraint task_comments_not_self_reply check (reply_to_comment_id is null or reply_to_comment_id <> id)
);

create index task_comments_workspace_task_created_idx
  on public.task_comments(workspace_id, task_id, created_at)
  where deleted_at is null;

create table public.task_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null,
  comment_id uuid,
  kind text not null check (kind in ('attachment', 'final_delivery', 'comment_attachment')),
  file_name text not null check (length(btrim(file_name)) > 0),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  storage_path text,
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint task_files_task_fk foreign key (workspace_id, task_id)
    references public.tasks(workspace_id, id) on delete cascade,
  constraint task_files_comment_fk foreign key (workspace_id, task_id, comment_id)
    references public.task_comments(workspace_id, task_id, id) on delete restrict,
  constraint task_files_creator_fk foreign key (workspace_id, created_by_member_id)
    references public.workspace_members(workspace_id, id) on delete set null (created_by_member_id),
  constraint task_files_comment_kind_check check (
    (kind = 'comment_attachment' and comment_id is not null)
    or (kind <> 'comment_attachment' and comment_id is null)
  )
);

create index task_files_workspace_task_created_idx on public.task_files(workspace_id, task_id, created_at desc);
create index task_files_workspace_comment_idx on public.task_files(workspace_id, task_id, comment_id)
  where comment_id is not null;

create table public.task_saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  member_id uuid not null,
  name text not null check (length(btrim(name)) > 0),
  view_type text not null check (view_type in ('dashboard', 'calendar', 'kanban', 'list')),
  settings jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  constraint task_saved_views_member_fk foreign key (workspace_id, member_id)
    references public.workspace_members(workspace_id, id) on delete cascade
);

create unique index task_saved_views_one_default_per_type_idx
  on public.task_saved_views(workspace_id, member_id, view_type)
  where is_default = true;
create index task_saved_views_workspace_member_type_idx
  on public.task_saved_views(workspace_id, member_id, view_type);

create trigger sprints_set_updated_at before update on public.sprints
for each row execute function public.set_updated_at();
create trigger task_checklist_items_set_updated_at before update on public.task_checklist_items
for each row execute function public.set_updated_at();
create trigger task_comments_set_updated_at before update on public.task_comments
for each row execute function public.set_updated_at();
create trigger task_saved_views_set_updated_at before update on public.task_saved_views
for each row execute function public.set_updated_at();

alter table public.sprints enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_files enable row level security;
alter table public.task_saved_views enable row level security;

create policy sprints_select_member on public.sprints
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy sprints_insert_member on public.sprints
for insert to authenticated
with check (private.is_workspace_member(workspace_id));
create policy sprints_update_member on public.sprints
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

create policy task_checklist_items_select_member on public.task_checklist_items
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy task_checklist_items_insert_member on public.task_checklist_items
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by_member_id is null
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = task_checklist_items.workspace_id
        and wm.id = task_checklist_items.created_by_member_id
        and wm.status = 'active'
    )
  )
);
create policy task_checklist_items_update_member on public.task_checklist_items
for update to authenticated
using (private.is_workspace_member(workspace_id))
with check (
  private.is_workspace_member(workspace_id)
  and (
    completed_by_member_id is null
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = task_checklist_items.workspace_id
        and wm.id = task_checklist_items.completed_by_member_id
        and wm.status = 'active'
    )
  )
);
create policy task_checklist_items_delete_member on public.task_checklist_items
for delete to authenticated
using (private.is_workspace_member(workspace_id));

create policy task_comments_select_member on public.task_comments
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy task_comments_insert_author on public.task_comments
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = task_comments.workspace_id
      and wm.id = task_comments.author_member_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
);
create policy task_comments_update_author on public.task_comments
for update to authenticated
using (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = task_comments.workspace_id
      and wm.id = task_comments.author_member_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = task_comments.workspace_id
      and wm.id = task_comments.author_member_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
);

create policy task_files_select_member on public.task_files
for select to authenticated
using (private.is_workspace_member(workspace_id));
create policy task_files_insert_member on public.task_files
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and (
    created_by_member_id is null
    or exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = task_files.workspace_id
        and wm.id = task_files.created_by_member_id
        and wm.status = 'active'
    )
  )
);
create policy task_files_delete_member on public.task_files
for delete to authenticated
using (private.is_workspace_member(workspace_id));

create policy task_saved_views_select_owner on public.task_saved_views
for select to authenticated
using (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = task_saved_views.workspace_id
      and wm.id = task_saved_views.member_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
);
create policy task_saved_views_insert_owner on public.task_saved_views
for insert to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = task_saved_views.workspace_id
      and wm.id = task_saved_views.member_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
);
create policy task_saved_views_update_owner on public.task_saved_views
for update to authenticated
using (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = task_saved_views.workspace_id
      and wm.id = task_saved_views.member_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
)
with check (
  private.is_workspace_member(workspace_id)
  and exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = task_saved_views.workspace_id
      and wm.id = task_saved_views.member_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'active'
  )
);

alter table public.activity_log
  drop constraint if exists activity_log_entity_type_check;

alter table public.activity_log
  add constraint activity_log_entity_type_check
  check (entity_type in ('client', 'contract', 'project', 'task'));
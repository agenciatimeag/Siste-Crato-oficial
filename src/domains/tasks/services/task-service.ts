import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { recordActivity } from '@/domains/activity/activity-service'
import { getProject } from '@/domains/projects/services/project-service'
import { DomainError } from '@/domains/shared/domain-error'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { taskCreateSchema, taskUpdateSchema } from '@/domains/tasks/schemas/task-schema'
import type { Task, TaskCreateInput, TaskSubtaskInput, TaskUpdateInput } from '@/domains/tasks/types'
import { getTask, listTasks } from '@/domains/tasks/queries/task-query-service'
import { resolveDepartmentChange, resolveTaskTypeChange, resolveWorkflowPosition } from '@/domains/workflows/queries/workflow-queries'
import { getWorkflowForTaskType } from '@/domains/workflows/queries/workflow-queries'
import type { WorkflowDepartment } from '@/domains/workflows/types'

async function requireActiveMember(workspaceId: string, memberId: string, client: SupabaseClient<Database>) {
  const { data, error } = await client.from('workspace_members').select('id')
    .eq('workspace_id', workspaceId).eq('id', memberId).eq('status', 'active').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('O membro selecionado não está ativo neste workspace.', 'WORKSPACE_MEMBER_NOT_ACTIVE')
}

async function validateAssignments(
  workspaceId: string,
  assigneeMemberId: string | null,
  reviewerMemberId: string | null,
  client: SupabaseClient<Database>,
) {
  const memberIds = [...new Set([assigneeMemberId, reviewerMemberId].filter((id): id is string => Boolean(id)))]
  await Promise.all(memberIds.map((memberId) => requireActiveMember(workspaceId, memberId, client)))
}

async function requireActiveSprint(
  workspaceId: string,
  sprintId: string,
  client: SupabaseClient<Database>,
) {
  const { data, error } = await client.from('sprints').select('id, is_active')
    .eq('workspace_id', workspaceId).eq('id', sprintId).maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Sprint não encontrada neste workspace.', 'SPRINT_NOT_FOUND')
  if (!data.is_active) throw new DomainError('Sprint inativa não pode receber tarefas.', 'SPRINT_INACTIVE')
}

async function getTaskWorkflowDepartment(
  workspaceId: string,
  task: Task,
  client: SupabaseClient<Database>,
): Promise<WorkflowDepartment> {
  const workflow = await getWorkflowForTaskType(workspaceId, task.task_type_id, {}, client)
  const department = workflow.departments.find(({ steps }) =>
    steps.some(({ id }) => id === task.workflow_step_id),
  )
  if (!department) throw mapTaskError({ code: '23514', message: 'INVALID_WORKFLOW_POSITION' })
  return department
}

async function writeTaskActivity(
  workspaceId: string,
  taskId: string,
  action: string,
  actorMemberId: string | null | undefined,
  metadata: Record<string, unknown>,
  client: SupabaseClient<Database>,
) {
  try {
    await recordActivity({
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      action,
      actorMemberId,
      metadata,
    }, client)
  } catch (error) {
    throw mapTaskError(error)
  }
}

export async function createTask(
  workspaceId: string,
  input: TaskCreateInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Task> {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
  const values = taskCreateSchema.parse(input)
  await getProject(workspaceId, values.project_id, client)
  if (values.parent_task_id) {
    const parent = await getTask(workspaceId, values.parent_task_id, client)
    if (parent.project_id !== values.project_id) {
      throw new DomainError('A subtarefa precisa pertencer ao mesmo projeto da tarefa principal.', 'PARENT_TASK_MUST_SHARE_PROJECT')
    }
  }
  await validateAssignments(workspaceId, values.assignee_member_id, values.reviewer_member_id, client)
  if (values.sprint_id) await requireActiveSprint(workspaceId, values.sprint_id, client)
  const resolvedPosition = await resolveWorkflowPosition(workspaceId, {
    taskTypeId: values.task_type_id,
    departmentId: values.department_id ?? undefined,
    workflowStepId: values.workflow_step_id ?? undefined,
  }, client)
  const { department_id: _departmentId, workflow_step_id: _requestedStepId, ...fields } = values
  const { data, error } = await client.from('tasks').insert({
    ...fields,
    workspace_id: workspaceId,
    workflow_step_id: resolvedPosition.workflowStep.id,
    created_by_member_id: actorMemberId ?? null,
  }).select('*').single()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Não foi possível criar a tarefa.', 'TASK_CREATE_FAILED')

  await writeTaskActivity(workspaceId, data.id, 'task.created', actorMemberId, {
    project_id: data.project_id,
    task_type_id: data.task_type_id,
    workflow_step_id: data.workflow_step_id,
    department_id: resolvedPosition.department.id,
    parent_task_id: data.parent_task_id,
  }, client)
  return data
}

function taskEditableFields(task: Task) {
  return {
    title: task.title,
    briefing: task.briefing,
    final_copy: task.final_copy,
    priority: task.priority,
    assignee_member_id: task.assignee_member_id,
    reviewer_member_id: task.reviewer_member_id,
    start_date: task.start_date,
    execution_date: task.execution_date,
    due_date: task.due_date,
    publication_date: task.publication_date,
    sort_order: task.sort_order,
  }
}

function getTaskUpdateAction(changedFields: string[]) {
  const dateFields = ['start_date', 'execution_date', 'due_date', 'publication_date']
  if (changedFields.length > 0 && changedFields.every((field) => dateFields.includes(field))) {
    return 'task.dates_changed'
  }
  if (changedFields.length === 1) {
    if (changedFields[0] === 'final_copy') return 'task.final_copy_updated'
    if (changedFields[0] === 'priority') return 'task.priority_changed'
    if (changedFields[0] === 'assignee_member_id') return 'task.assignee_changed'
    if (changedFields[0] === 'reviewer_member_id') return 'task.reviewer_changed'
  }
  return 'task.updated'
}

export async function updateTask(
  workspaceId: string,
  taskId: string,
  input: TaskUpdateInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Task> {
  const current = await getTask(workspaceId, taskId, client)
  const parsedValues = taskUpdateSchema.parse({ ...taskEditableFields(current), ...input })
  const changedFields = Object.entries(parsedValues)
    .filter(([field, value]) => current[field as keyof Task] !== value)
    .map(([field]) => field)
  if (changedFields.length === 0) return current

  if (changedFields.includes('assignee_member_id') && parsedValues.assignee_member_id) {
    await requireActiveMember(workspaceId, parsedValues.assignee_member_id, client)
  }
  if (changedFields.includes('reviewer_member_id') && parsedValues.reviewer_member_id) {
    await requireActiveMember(workspaceId, parsedValues.reviewer_member_id, client)
  }

  const payload = Object.fromEntries(changedFields.map((field) => [field, parsedValues[field as keyof typeof parsedValues]])) as TaskUpdateInput
  const { data, error } = await client.from('tasks').update(payload)
    .eq('workspace_id', workspaceId).eq('id', taskId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Tarefa não encontrada neste workspace.', 'TASK_NOT_FOUND')

  const metadata: Record<string, unknown> = { changed_fields: changedFields }
  if (changedFields.includes('priority')) metadata.priority = { from: current.priority, to: data.priority }
  if (changedFields.includes('assignee_member_id')) metadata.assignee_member_id = data.assignee_member_id
  if (changedFields.includes('reviewer_member_id')) metadata.reviewer_member_id = data.reviewer_member_id
  if (changedFields.some((field) => ['start_date', 'execution_date', 'due_date', 'publication_date'].includes(field))) {
    metadata.dates = {
      start_date: data.start_date,
      execution_date: data.execution_date,
      due_date: data.due_date,
      publication_date: data.publication_date,
    }
  }
  await writeTaskActivity(workspaceId, taskId, getTaskUpdateAction(changedFields), actorMemberId, metadata, client)
  return data
}

async function writeWorkflowTransition(
  workspaceId: string,
  current: Task,
  next: { taskTypeId: string; workflowStepId: string; departmentId: string; operationalNature: string },
  action: 'task.workflow_changed' | 'task.type_changed',
  actorMemberId: string | null | undefined,
  client: SupabaseClient<Database>,
) {
  if (current.workflow_step_id === next.workflowStepId && current.task_type_id === next.taskTypeId) return current
  const previousPosition = await getTaskWorkflowDepartment(workspaceId, current, client)
  const updatePayload = action === 'task.type_changed'
    ? { task_type_id: next.taskTypeId, workflow_step_id: next.workflowStepId }
    : { workflow_step_id: next.workflowStepId }
  const { data, error } = await client.from('tasks').update(updatePayload)
    .eq('workspace_id', workspaceId).eq('id', current.id).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Tarefa não encontrada neste workspace.', 'TASK_NOT_FOUND')

  await writeTaskActivity(workspaceId, current.id, action, actorMemberId, {
    previous_task_type_id: current.task_type_id,
    task_type_id: data.task_type_id,
    previous_workflow_step_id: current.workflow_step_id,
    workflow_step_id: data.workflow_step_id,
    previous_department_id: previousPosition.department.id,
    department_id: next.departmentId,
    previous_operational_nature: previousPosition.steps.find(({ id }) => id === current.workflow_step_id)?.operational_nature,
    operational_nature: next.operationalNature,
  }, client)
  return data
}

export async function moveTaskToStep(
  workspaceId: string,
  taskId: string,
  workflowStepId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const current = await getTask(workspaceId, taskId, client)
  const position = await resolveWorkflowPosition(workspaceId, {
    taskTypeId: current.task_type_id,
    workflowStepId,
  }, client)
  return writeWorkflowTransition(workspaceId, current, {
    taskTypeId: current.task_type_id,
    workflowStepId: position.workflowStep.id,
    departmentId: position.department.id,
    operationalNature: position.workflowStep.operational_nature,
  }, 'task.workflow_changed', actorMemberId, client)
}

export async function moveTaskToDepartment(
  workspaceId: string,
  taskId: string,
  departmentId: string,
  workflowStepId?: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const current = await getTask(workspaceId, taskId, client)
  const position = await resolveDepartmentChange(workspaceId, current.task_type_id, departmentId, workflowStepId, client)
  return writeWorkflowTransition(workspaceId, current, {
    taskTypeId: current.task_type_id,
    workflowStepId: position.workflowStep.id,
    departmentId: position.department.id,
    operationalNature: position.workflowStep.operational_nature,
  }, 'task.workflow_changed', actorMemberId, client)
}

export async function changeTaskType(
  workspaceId: string,
  taskId: string,
  taskTypeId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const current = await getTask(workspaceId, taskId, client)
  if (current.task_type_id === taskTypeId) return current
  const position = await resolveTaskTypeChange(workspaceId, taskTypeId, current.workflow_step_id, client)
  return writeWorkflowTransition(workspaceId, current, {
    taskTypeId,
    workflowStepId: position.workflowStep.id,
    departmentId: position.department.id,
    operationalNature: position.workflowStep.operational_nature,
  }, 'task.type_changed', actorMemberId, client)
}

export async function setTaskSprint(
  workspaceId: string,
  taskId: string,
  sprintId: string | null,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const current = await getTask(workspaceId, taskId, client)
  if (current.sprint_id === sprintId) return current
  if (sprintId) await requireActiveSprint(workspaceId, sprintId, client)
  const { data, error } = await client.from('tasks').update({ sprint_id: sprintId })
    .eq('workspace_id', workspaceId).eq('id', taskId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Tarefa não encontrada neste workspace.', 'TASK_NOT_FOUND')
  await writeTaskActivity(workspaceId, taskId, 'task.sprint_changed', actorMemberId, {
    previous_sprint_id: current.sprint_id,
    sprint_id: sprintId,
  }, client)
  return data
}

async function setArchived(
  workspaceId: string,
  taskId: string,
  archivedAt: string | null,
  actorMemberId: string | null | undefined,
  client: SupabaseClient<Database>,
) {
  const current = await getTask(workspaceId, taskId, client)
  if (current.archived_at === null && archivedAt === null) return current
  if (current.archived_at !== null && archivedAt !== null) return current
  const { data, error } = await client.from('tasks').update({ archived_at: archivedAt })
    .eq('workspace_id', workspaceId).eq('id', taskId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Tarefa não encontrada neste workspace.', 'TASK_NOT_FOUND')
  await writeTaskActivity(workspaceId, taskId, archivedAt ? 'task.archived' : 'task.restored', actorMemberId, {
    archived_at: archivedAt,
  }, client)
  return data
}

export async function archiveTask(
  workspaceId: string,
  taskId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  return setArchived(workspaceId, taskId, new Date().toISOString(), actorMemberId, client)
}

export async function restoreTask(
  workspaceId: string,
  taskId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  return setArchived(workspaceId, taskId, null, actorMemberId, client)
}

export async function createSubtask(
  workspaceId: string,
  parentTaskId: string,
  input: TaskSubtaskInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const parent = await getTask(workspaceId, parentTaskId, client)
  if (input.project_id && input.project_id !== parent.project_id) {
    throw new DomainError('A subtarefa precisa pertencer ao mesmo projeto da tarefa principal.', 'PARENT_TASK_MUST_SHARE_PROJECT')
  }
  return createTask(workspaceId, { ...input, project_id: parent.project_id, parent_task_id: parent.id }, actorMemberId, client)
}

export async function assignTask(
  workspaceId: string,
  taskId: string,
  assigneeMemberId: string | null,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  return updateTask(workspaceId, taskId, { assignee_member_id: assigneeMemberId }, actorMemberId, client)
}

export async function setTaskReviewer(
  workspaceId: string,
  taskId: string,
  reviewerMemberId: string | null,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  return updateTask(workspaceId, taskId, { reviewer_member_id: reviewerMemberId }, actorMemberId, client)
}

export async function setTaskSortOrder(
  workspaceId: string,
  taskId: string,
  sortOrder: number,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  return updateTask(workspaceId, taskId, { sort_order: sortOrder }, actorMemberId, client)
}

export async function reorderTasksInProject(
  workspaceId: string,
  projectId: string,
  orderedTaskIds: string[],
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  await getProject(workspaceId, projectId, client)
  const tasks = await listTasks(workspaceId, { projectId }, client)
  const existingIds = new Set(tasks.map(({ id }) => id))
  if (
    orderedTaskIds.length !== tasks.length
    || new Set(orderedTaskIds).size !== orderedTaskIds.length
    || orderedTaskIds.some((id) => !existingIds.has(id))
  ) {
    throw new DomainError('A ordenação deve conter cada tarefa ativa do projeto exatamente uma vez.', 'INVALID_TASK_REORDER')
  }

  const updatedTasks: Task[] = []
  for (const [sortOrder, taskId] of orderedTaskIds.entries()) {
    const task = tasks.find(({ id }) => id === taskId)!
    if (task.sort_order === sortOrder) {
      updatedTasks.push(task)
      continue
    }
    const { data, error } = await client.from('tasks').update({ sort_order: sortOrder })
      .eq('workspace_id', workspaceId).eq('project_id', projectId).eq('id', taskId).select('*').maybeSingle()
    if (error) throw mapTaskError(error)
    if (!data) throw new DomainError('Tarefa não encontrada neste workspace e projeto.', 'TASK_NOT_FOUND')
    await writeTaskActivity(workspaceId, taskId, 'task.updated', actorMemberId, {
      changed_fields: ['sort_order'], sort_order: { from: task.sort_order, to: sortOrder },
    }, client)
    updatedTasks.push(data)
  }
  return updatedTasks
}

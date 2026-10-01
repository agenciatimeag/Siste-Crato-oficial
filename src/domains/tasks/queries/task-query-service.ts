import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { listActivity } from '@/domains/activity/activity-query-service'
import { getClient } from '@/domains/clients/services/client-service'
import { getProject } from '@/domains/projects/services/project-service'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { getTaskType } from '@/domains/workflows/queries/catalog-queries'
import { getWorkflowForTaskType } from '@/domains/workflows/queries/workflow-queries'
import type { Sprint, Task, TaskDetail, TaskListFilters, TaskMemberDetails } from '@/domains/tasks/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export async function listTasks(
  workspaceId: string,
  filters: TaskListFilters = {},
  client: SupabaseClient<Database> = supabase,
): Promise<Task[]> {
  requireWorkspace(workspaceId)
  let query = client.from('tasks').select('*').eq('workspace_id', workspaceId)

  if (filters.archivedOnly) query = query.not('archived_at', 'is', null)
  else if (!filters.includeArchived) query = query.is('archived_at', null)
  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.sprintId) query = query.eq('sprint_id', filters.sprintId)
  if (filters.assigneeMemberId) query = query.eq('assignee_member_id', filters.assigneeMemberId)
  if (filters.reviewerMemberId) query = query.eq('reviewer_member_id', filters.reviewerMemberId)
  if (filters.taskTypeId) query = query.eq('task_type_id', filters.taskTypeId)
  if (filters.workflowStepId) query = query.eq('workflow_step_id', filters.workflowStepId)
  if (filters.parentTaskId === null) query = query.is('parent_task_id', null)
  else if (filters.parentTaskId) query = query.eq('parent_task_id', filters.parentTaskId)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.dueDateFrom) query = query.gte('due_date', filters.dueDateFrom)
  if (filters.dueDateTo) query = query.lte('due_date', filters.dueDateTo)
  if (filters.executionDateFrom) query = query.gte('execution_date', filters.executionDateFrom)
  if (filters.executionDateTo) query = query.lte('execution_date', filters.executionDateTo)
  if (filters.publicationDateFrom) query = query.gte('publication_date', filters.publicationDateFrom)
  if (filters.publicationDateTo) query = query.lte('publication_date', filters.publicationDateTo)
  if (filters.overdueOnly) {
    query = query.lt('due_date', filters.overdueAsOf ?? new Date().toISOString().slice(0, 10))
      .is('completed_at', null)
  }
  if (filters.search?.trim()) query = query.ilike('title', `%${filters.search.trim()}%`)

  const { data, error } = await query.order('sort_order').order('created_at')
  if (error) throw mapTaskError(error)
  return data ?? []
}

export function listTasksByProject(workspaceId: string, projectId: string, filters: TaskListFilters = {}, client: SupabaseClient<Database> = supabase) {
  return listTasks(workspaceId, { ...filters, projectId }, client)
}

export function listTasksByAssignee(workspaceId: string, memberId: string, filters: TaskListFilters = {}, client: SupabaseClient<Database> = supabase) {
  return listTasks(workspaceId, { ...filters, assigneeMemberId: memberId }, client)
}

export function listTasksByReviewer(workspaceId: string, memberId: string, filters: TaskListFilters = {}, client: SupabaseClient<Database> = supabase) {
  return listTasks(workspaceId, { ...filters, reviewerMemberId: memberId }, client)
}

export function listTasksByType(workspaceId: string, taskTypeId: string, filters: TaskListFilters = {}, client: SupabaseClient<Database> = supabase) {
  return listTasks(workspaceId, { ...filters, taskTypeId }, client)
}

export function listTasksByWorkflowStep(workspaceId: string, workflowStepId: string, filters: TaskListFilters = {}, client: SupabaseClient<Database> = supabase) {
  return listTasks(workspaceId, { ...filters, workflowStepId }, client)
}

export function listOverdueTasks(workspaceId: string, asOf = new Date().toISOString().slice(0, 10), filters: TaskListFilters = {}, client: SupabaseClient<Database> = supabase) {
  return listTasks(workspaceId, { ...filters, overdueOnly: true, overdueAsOf: asOf }, client)
}

export function listArchivedTasks(workspaceId: string, filters: TaskListFilters = {}, client: SupabaseClient<Database> = supabase) {
  return listTasks(workspaceId, { ...filters, includeArchived: true, archivedOnly: true }, client)
}

export async function getTask(
  workspaceId: string,
  taskId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Task> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('tasks').select('*')
    .eq('workspace_id', workspaceId).eq('id', taskId).maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Tarefa não encontrada neste workspace.', 'TASK_NOT_FOUND')
  return data
}

async function getTaskMember(workspaceId: string, memberId: string | null, client: SupabaseClient<Database>): Promise<TaskMemberDetails | null> {
  if (!memberId) return null
  const { data, error } = await client.from('workspace_members').select('*')
    .eq('workspace_id', workspaceId).eq('id', memberId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) return null
  const { data: profile, error: profileError } = await client.from('profiles').select('id, full_name, avatar_url')
    .eq('id', data.user_id).maybeSingle()
  if (profileError) throw mapDatabaseError(profileError)
  return { member: data, profile }
}

async function getTaskSprint(workspaceId: string, sprintId: string | null, client: SupabaseClient<Database>): Promise<Sprint | null> {
  if (!sprintId) return null
  const { data, error } = await client.from('sprints').select('*')
    .eq('workspace_id', workspaceId).eq('id', sprintId).maybeSingle()
  if (error) throw mapTaskError(error)
  return data
}

export async function getTaskDetails(
  workspaceId: string,
  taskId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskDetail> {
  const task = await getTask(workspaceId, taskId, client)
  const [project, taskType, workflow, assignee, reviewer, sprint] = await Promise.all([
    getProject(workspaceId, task.project_id, client),
    getTaskType(workspaceId, task.task_type_id, client),
    getWorkflowForTaskType(workspaceId, task.task_type_id, {}, client),
    getTaskMember(workspaceId, task.assignee_member_id, client),
    getTaskMember(workspaceId, task.reviewer_member_id, client),
    getTaskSprint(workspaceId, task.sprint_id, client),
  ])
  const flowDepartment = workflow.departments.find(({ steps }) =>
    steps.some(({ id }) => id === task.workflow_step_id),
  )
  const workflowStep = flowDepartment?.steps.find(({ id }) => id === task.workflow_step_id)
  if (!flowDepartment || !workflowStep) throw mapTaskError({ code: '23514', message: 'INVALID_WORKFLOW_POSITION' })
  const customer = await getClient(workspaceId, project.client_id, client)
  return {
    task,
    project,
    sprint,
    client: customer,
    taskType,
    department: flowDepartment.department,
    workflowStep,
    assignee,
    reviewer,
  }
}

export async function getParentTask(
  workspaceId: string,
  taskId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Task | null> {
  const task = await getTask(workspaceId, taskId, client)
  if (!task.parent_task_id) return null
  return getTask(workspaceId, task.parent_task_id, client)
}

export async function listSubtasks(
  workspaceId: string,
  parentTaskId: string,
  options: { includeArchived?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<Task[]> {
  await getTask(workspaceId, parentTaskId, client)
  return listTasks(workspaceId, {
    parentTaskId,
    includeArchived: options.includeArchived,
  }, client)
}

export async function listTaskActivity(
  workspaceId: string,
  taskId: string,
  client: SupabaseClient<Database> = supabase,
) {
  await getTask(workspaceId, taskId, client)
  return listActivity(workspaceId, 'task', taskId, client)
}
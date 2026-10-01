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
import type {
  CalendarQueryParams,
  KanbanBoard,
  KanbanColumn,
  KanbanData,
  KanbanDepartmentSection,
  KanbanOptions,
  Sprint,
  Task,
  TaskDashboardData,
  TaskDashboardOptions,
  TaskDetail,
  TaskListFilters,
  TaskMemberDetails,
  TaskState,
  TaskSummary,
} from '@/domains/tasks/types'
import type { OperationalNature, TaskType, WorkflowStep } from '@/domains/workflows/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export function resolveTaskState(filters: TaskListFilters): TaskState | null {
  const raw = filters.state ?? (filters as Record<string, unknown>).status
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim()
    if (s === 'active' || s === 'ativas' || s === 'ativa') return 'active'
    if (s === 'completed' || s === 'concluidas' || s === 'concluídas' || s === 'concluida' || s === 'concluída') return 'completed'
    if (s === 'archived' || s === 'arquivadas' || s === 'arquivada') return 'archived'
    if (s === 'all' || s === 'todas' || s === 'todos') return 'all'
  }
  if (filters.archivedOnly) return 'archived'
  if (filters.completedOnly) return 'completed'
  return null
}

async function resolveProjectIdsForClient(
  workspaceId: string,
  clientId: string,
  client: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await client.from('projects').select('id')
    .eq('workspace_id', workspaceId).eq('client_id', clientId)
  if (error) throw mapTaskError(error)
  return (data ?? []).map((p) => p.id)
}

async function resolveStepIdsForDepartment(
  workspaceId: string,
  departmentId: string,
  client: SupabaseClient<Database>,
): Promise<string[]> {
  const { data: ttds, error: ttdError } = await client.from('task_type_departments').select('id')
    .eq('workspace_id', workspaceId).eq('department_id', departmentId)
  if (ttdError) throw mapTaskError(ttdError)
  const ttdIds = (ttds ?? []).map((t) => t.id)
  if (ttdIds.length === 0) return []

  const { data: steps, error: stepError } = await client.from('workflow_steps').select('id')
    .eq('workspace_id', workspaceId).in('task_type_department_id', ttdIds)
  if (stepError) throw mapTaskError(stepError)
  return (steps ?? []).map((s) => s.id)
}

async function resolveSearchMatchingProjectIds(
  workspaceId: string,
  term: string,
  client: SupabaseClient<Database>,
): Promise<string[]> {
  const matchingProjectIds = new Set<string>()
  try {
    const { data: projByName } = await client.from('projects').select('id')
      .eq('workspace_id', workspaceId).ilike('name', `%${term}%`)
    if (projByName) {
      for (const p of projByName) matchingProjectIds.add(p.id)
    }

    const { data: clientsByName } = await client.from('clients').select('id')
      .eq('workspace_id', workspaceId).ilike('display_name', `%${term}%`)
    if (clientsByName && clientsByName.length > 0) {
      const clientIds = clientsByName.map((c) => c.id)
      const { data: projByClient } = await client.from('projects').select('id')
        .eq('workspace_id', workspaceId).in('client_id', clientIds)
      if (projByClient) {
        for (const p of projByClient) matchingProjectIds.add(p.id)
      }
    }
  } catch {
    // Fallback for mocks
  }
  return [...matchingProjectIds]
}

export async function listTasks(
  workspaceId: string,
  filters: TaskListFilters = {},
  client: SupabaseClient<Database> = supabase,
): Promise<Task[]> {
  requireWorkspace(workspaceId)

  let allowedProjectIds: string[] | null = null
  if (filters.clientId) {
    allowedProjectIds = await resolveProjectIdsForClient(workspaceId, filters.clientId, client)
    if (allowedProjectIds.length === 0) return []
    if (filters.projectId && !allowedProjectIds.includes(filters.projectId)) return []
  }

  let allowedStepIds: string[] | null = null
  if (filters.departmentId) {
    allowedStepIds = await resolveStepIdsForDepartment(workspaceId, filters.departmentId, client)
    if (allowedStepIds.length === 0) return []
    if (filters.workflowStepId && !allowedStepIds.includes(filters.workflowStepId)) return []
  }

  let query = client.from('tasks').select('*').eq('workspace_id', workspaceId)

  const resolvedState = resolveTaskState(filters)
  if (resolvedState === 'active') {
    query = query.is('archived_at', null).is('completed_at', null)
  } else if (resolvedState === 'completed') {
    query = query.is('archived_at', null).not('completed_at', 'is', null)
  } else if (resolvedState === 'archived') {
    query = query.not('archived_at', 'is', null)
  } else if (resolvedState === 'all') {
    // No filter on archived_at or completed_at
  } else {
    if (filters.archivedOnly) query = query.not('archived_at', 'is', null)
    else if (!filters.includeArchived) query = query.is('archived_at', null)
    if (filters.completedOnly) query = query.not('completed_at', 'is', null)
  }

  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  } else if (allowedProjectIds) {
    query = query.in('project_id', allowedProjectIds)
  }

  if (filters.workflowStepId) {
    query = query.eq('workflow_step_id', filters.workflowStepId)
  } else if (allowedStepIds) {
    query = query.in('workflow_step_id', allowedStepIds)
  }

  if (filters.sprintId) query = query.eq('sprint_id', filters.sprintId)
  if (filters.assigneeMemberId) query = query.eq('assignee_member_id', filters.assigneeMemberId)
  if (filters.reviewerMemberId) query = query.eq('reviewer_member_id', filters.reviewerMemberId)
  if (filters.taskTypeId) query = query.eq('task_type_id', filters.taskTypeId)
  if (filters.parentTaskId === null) query = query.is('parent_task_id', null)
  else if (filters.parentTaskId) query = query.eq('parent_task_id', filters.parentTaskId)
  if (filters.priority) query = query.eq('priority', filters.priority)
  if (filters.startDateFrom) query = query.gte('start_date', filters.startDateFrom)
  if (filters.startDateTo) query = query.lte('start_date', filters.startDateTo)
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

  if (filters.search?.trim()) {
    const rawSearch = filters.search.trim()
    const numberMatch = /^#?(\d+)$/.exec(rawSearch)
    if (numberMatch) {
      const num = parseInt(numberMatch[1], 10)
      if (typeof query.or === 'function') {
        query = query.or(`task_number.eq.${num},title.ilike.%${rawSearch}%`)
      } else {
        query = query.eq('task_number', num)
      }
    } else {
      const matchingProjectIds = await resolveSearchMatchingProjectIds(workspaceId, rawSearch, client)
      if (matchingProjectIds.length > 0 && typeof query.or === 'function') {
        query = query.or(`title.ilike.%${rawSearch}%,project_id.in.(${matchingProjectIds.join(',')})`)
      } else {
        query = query.ilike('title', `%${rawSearch}%`)
      }
    }
  }

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

export async function getTaskByNumber(
  workspaceId: string,
  taskNumber: number | string,
  client: SupabaseClient<Database> = supabase,
): Promise<Task> {
  requireWorkspace(workspaceId)
  const num = typeof taskNumber === 'string'
    ? parseInt(taskNumber.replace(/^#/, '').trim(), 10)
    : taskNumber
  if (!Number.isFinite(num)) {
    throw new DomainError('Número de tarefa inválido.', 'INVALID_TASK_NUMBER')
  }
  const { data, error } = await client.from('tasks').select('*')
    .eq('workspace_id', workspaceId).eq('task_number', num).maybeSingle()
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

export async function enrichTaskSummaries(
  workspaceId: string,
  tasks: Task[],
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSummary[]> {
  requireWorkspace(workspaceId)
  if (tasks.length === 0) return []

  const projectIds = [...new Set(tasks.map((t) => t.project_id))]
  const taskTypeIds = [...new Set(tasks.map((t) => t.task_type_id))]
  const stepIds = [...new Set(tasks.map((t) => t.workflow_step_id))]
  const memberIds = [...new Set(tasks.flatMap((t) => [t.assignee_member_id, t.reviewer_member_id]).filter((id): id is string => Boolean(id)))]
  const sprintIds = [...new Set(tasks.map((t) => t.sprint_id).filter((id): id is string => Boolean(id)))]

  const [
    projectsData,
    taskTypesData,
    workflowData,
    membersData,
    sprintsData,
  ] = await Promise.all([
    // 1. Projects & Clients
    (async () => {
      if (projectIds.length === 0) return { projects: [], clients: [] }
      const { data: projects, error: pErr } = await client.from('projects').select('id, name, client_id')
        .eq('workspace_id', workspaceId).in('id', projectIds)
      if (pErr) throw mapTaskError(pErr)
      const pList = projects ?? []
      const clientIds = [...new Set(pList.map((p) => p.client_id))]
      if (clientIds.length === 0) return { projects: pList, clients: [] }
      const { data: clients, error: cErr } = await client.from('clients').select('id, display_name')
        .eq('workspace_id', workspaceId).in('id', clientIds)
      if (cErr) throw mapTaskError(cErr)
      return { projects: pList, clients: clients ?? [] }
    })(),

    // 2. Task Types
    (async () => {
      if (taskTypeIds.length === 0) return []
      const { data, error } = await client.from('task_types').select('id, name')
        .eq('workspace_id', workspaceId).in('id', taskTypeIds)
      if (error) throw mapTaskError(error)
      return data ?? []
    })(),

    // 3. Workflow Steps, TTDs & Departments
    (async () => {
      if (stepIds.length === 0) return { steps: [], ttds: [], departments: [] }
      const { data: steps, error: sErr } = await client.from('workflow_steps')
        .select('id, name, operational_nature, task_type_department_id, is_internal_review, is_external_review')
        .eq('workspace_id', workspaceId).in('id', stepIds)
      if (sErr) throw mapTaskError(sErr)
      const sList = steps ?? []
      const ttdIds = [...new Set(sList.map((s) => s.task_type_department_id))]
      if (ttdIds.length === 0) return { steps: sList, ttds: [], departments: [] }
      const { data: ttds, error: ttdErr } = await client.from('task_type_departments')
        .select('id, department_id')
        .eq('workspace_id', workspaceId).in('id', ttdIds)
      if (ttdErr) throw mapTaskError(ttdErr)
      const ttdList = ttds ?? []
      const deptIds = [...new Set(ttdList.map((t) => t.department_id))]
      if (deptIds.length === 0) return { steps: sList, ttds: ttdList, departments: [] }
      const { data: departments, error: dErr } = await client.from('departments')
        .select('id, name')
        .eq('workspace_id', workspaceId).in('id', deptIds)
      if (dErr) throw mapTaskError(dErr)
      return { steps: sList, ttds: ttdList, departments: departments ?? [] }
    })(),

    // 4. Workspace Members & Profiles
    (async () => {
      if (memberIds.length === 0) return { members: [], profiles: [] }
      const { data: members, error: mErr } = await client.from('workspace_members').select('id, user_id')
        .eq('workspace_id', workspaceId).in('id', memberIds)
      if (mErr) throw mapTaskError(mErr)
      const mList = members ?? []
      const userIds = [...new Set(mList.map((m) => m.user_id))]
      if (userIds.length === 0) return { members: mList, profiles: [] }
      const { data: profiles, error: pErr } = await client.from('profiles').select('id, full_name, avatar_url')
        .in('id', userIds)
      if (pErr) throw mapTaskError(pErr)
      return { members: mList, profiles: profiles ?? [] }
    })(),

    // 5. Sprints
    (async () => {
      if (sprintIds.length === 0) return []
      const { data, error } = await client.from('sprints').select('id, name')
        .eq('workspace_id', workspaceId).in('id', sprintIds)
      if (error) throw mapTaskError(error)
      return data ?? []
    })(),
  ])

  const projectMap = new Map(projectsData.projects.map((p) => [p.id, p]))
  const clientMap = new Map(projectsData.clients.map((c) => [c.id, c]))
  const taskTypeMap = new Map(taskTypesData.map((t) => [t.id, t]))
  const ttdMap = new Map(workflowData.ttds.map((t) => [t.id, t.department_id]))
  const deptMap = new Map(workflowData.departments.map((d) => [d.id, d]))
  const stepMap = new Map(workflowData.steps.map((s) => [s.id, {
    id: s.id,
    name: s.name,
    operational_nature: s.operational_nature,
    departmentId: ttdMap.get(s.task_type_department_id),
  }]))
  const profileMap = new Map(membersData.profiles.map((p) => [p.id, p]))
  const memberMap = new Map(membersData.members.map((m) => {
    const prof = profileMap.get(m.user_id)
    return [m.id, {
      id: m.id,
      nome: prof?.full_name ?? 'Membro',
      name: prof?.full_name ?? 'Membro',
      avatar: prof?.avatar_url ?? null,
      avatar_url: prof?.avatar_url ?? null,
    }]
  }))
  const sprintMap = new Map(sprintsData.map((s) => [s.id, s]))

  return tasks.map((task) => {
    const project = projectMap.get(task.project_id) ?? { id: task.project_id, name: 'Projeto', client_id: '' }
    const customer = clientMap.get(project.client_id) ?? { id: project.client_id, display_name: 'Cliente' }
    const taskType = taskTypeMap.get(task.task_type_id) ?? { id: task.task_type_id, name: 'Tipo' }
    const stepInfo = stepMap.get(task.workflow_step_id) ?? {
      id: task.workflow_step_id,
      name: 'Etapa',
      operational_nature: 'todo' as const,
      departmentId: undefined,
    }
    const department = (stepInfo.departmentId ? deptMap.get(stepInfo.departmentId) : null) ?? {
      id: stepInfo.departmentId ?? '',
      name: 'Departamento',
    }
    const assignee = task.assignee_member_id ? memberMap.get(task.assignee_member_id) ?? null : null
    const reviewer = task.reviewer_member_id ? memberMap.get(task.reviewer_member_id) ?? null : null
    const sprint = task.sprint_id ? (sprintMap.get(task.sprint_id) ? { id: task.sprint_id, name: sprintMap.get(task.sprint_id)!.name } : null) : null

    return {
      id: task.id,
      task_number: task.task_number,
      title: task.title,
      priority: task.priority,
      start_date: task.start_date,
      execution_date: task.execution_date,
      due_date: task.due_date,
      publication_date: task.publication_date,
      completed_at: task.completed_at,
      archived_at: task.archived_at,
      project: { id: project.id, name: project.name },
      client: { id: customer.id, name: customer.display_name },
      type: { id: taskType.id, name: taskType.name },
      taskType: { id: taskType.id, name: taskType.name },
      department: { id: department.id, name: department.name },
      step: { id: stepInfo.id, name: stepInfo.name, operational_nature: stepInfo.operational_nature },
      workflowStep: { id: stepInfo.id, name: stepInfo.name, operational_nature: stepInfo.operational_nature },
      assignee,
      reviewer,
      sprint,
      parent_task_id: task.parent_task_id,
      sort_order: task.sort_order,
    }
  })
}

export async function listTaskSummaries(
  workspaceId: string,
  filters: TaskListFilters = {},
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSummary[]> {
  const tasks = await listTasks(workspaceId, filters, client)
  return enrichTaskSummaries(workspaceId, tasks, client)
}

export async function getTaskSummaryByNumber(
  workspaceId: string,
  taskNumber: number | string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSummary> {
  const task = await getTaskByNumber(workspaceId, taskNumber, client)
  const [summary] = await enrichTaskSummaries(workspaceId, [task], client)
  return summary
}

export async function listCalendarTasks(
  workspaceId: string,
  params: CalendarQueryParams,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSummary[]> {
  requireWorkspace(workspaceId)
  const { dateMode, rangeStart, rangeEnd, filters = {} } = params
  const dateFilters: TaskListFilters = { ...filters }

  if (dateMode === 'execution_date') {
    dateFilters.executionDateFrom = rangeStart
    dateFilters.executionDateTo = rangeEnd
  } else {
    dateFilters.dueDateFrom = rangeStart
    dateFilters.dueDateTo = rangeEnd
  }

  return listTaskSummaries(workspaceId, dateFilters, client)
}

export async function getTaskDashboardData(
  workspaceId: string,
  options: TaskDashboardOptions = {},
  client: SupabaseClient<Database> = supabase,
): Promise<TaskDashboardData> {
  requireWorkspace(workspaceId)
  const today = options.asOf ?? new Date().toISOString().slice(0, 10)

  const tasks = await listTasks(workspaceId, { ...options.filters, state: 'all' }, client)
  const nonArchivedTasks = tasks.filter((t) => t.archived_at === null)
  const activeTasks = nonArchivedTasks.filter((t) => t.completed_at === null)
  const completedTasks = nonArchivedTasks.filter((t) => t.completed_at !== null)

  const activeCount = activeTasks.length
  const completedCount = completedTasks.length
  const overdueCount = activeTasks.filter((t) => t.due_date && t.due_date < today).length
  const dueTodayCount = activeTasks.filter((t) => t.due_date && t.due_date === today).length

  const stepIds = [...new Set(nonArchivedTasks.map((t) => t.workflow_step_id))]
  let stepsMap = new Map<string, { operational_nature: OperationalNature; is_internal_review: boolean; is_external_review: boolean }>()
  if (stepIds.length > 0) {
    const { data: steps, error } = await client.from('workflow_steps')
      .select('id, operational_nature, is_internal_review, is_external_review')
      .eq('workspace_id', workspaceId).in('id', stepIds)
    if (error) throw mapTaskError(error)
    stepsMap = new Map((steps ?? []).map((s) => [s.id, s]))
  }

  let reviewCount = 0
  let waitingCount = 0
  for (const task of activeTasks) {
    const step = stepsMap.get(task.workflow_step_id)
    if (step) {
      if (step.is_internal_review || step.is_external_review) {
        reviewCount++
      } else if (step.operational_nature === 'waiting') {
        waitingCount++
      }
    }
  }

  const distributionByOperationalNature: Record<OperationalNature, number> = {
    todo: 0,
    in_progress: 0,
    waiting: 0,
    done: 0,
    complete: 0,
  }
  for (const task of nonArchivedTasks) {
    const step = stepsMap.get(task.workflow_step_id)
    const nature = step?.operational_nature ?? (task.completed_at ? 'complete' : 'todo')
    if (nature in distributionByOperationalNature) {
      distributionByOperationalNature[nature]++
    }
  }

  const dayCounts = new Map<string, number>()
  for (const task of activeTasks) {
    const date = task.execution_date || task.due_date
    if (date) {
      dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1)
    }
  }
  const workloadByDay = Array.from(dayCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  const assigneeCounts = new Map<string | null, number>()
  for (const task of activeTasks) {
    const memberId = task.assignee_member_id ?? null
    assigneeCounts.set(memberId, (assigneeCounts.get(memberId) ?? 0) + 1)
  }

  const assigneeMemberIds = [...assigneeCounts.keys()].filter((id): id is string => Boolean(id))
  let memberDetailsMap = new Map<string, { name: string; avatarUrl: string | null }>()
  if (assigneeMemberIds.length > 0) {
    const { data: members } = await client.from('workspace_members').select('id, user_id')
      .eq('workspace_id', workspaceId).in('id', assigneeMemberIds)
    const mList = members ?? []
    const userIds = mList.map((m) => m.user_id)
    if (userIds.length > 0) {
      const { data: profiles } = await client.from('profiles').select('id, full_name, avatar_url')
        .in('id', userIds)
      const profMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      for (const m of mList) {
        const prof = profMap.get(m.user_id)
        memberDetailsMap.set(m.id, {
          name: prof?.full_name ?? 'Membro',
          avatarUrl: prof?.avatar_url ?? null,
        })
      }
    }
  }

  const workloadByAssignee = Array.from(assigneeCounts.entries())
    .map(([memberId, count]) => {
      const details = memberId ? memberDetailsMap.get(memberId) : null
      return {
        memberId,
        name: details?.name ?? (memberId ? 'Membro' : 'Não atribuído'),
        avatarUrl: details?.avatarUrl ?? null,
        count,
      }
    })
    .sort((a, b) => b.count - a.count)

  return {
    activeCount,
    overdueCount,
    dueTodayCount,
    reviewCount,
    waitingCount,
    completedCount,
    workloadByDay,
    workloadByAssignee,
    distributionByOperationalNature,
  }
}

export async function getKanbanData(
  workspaceId: string,
  options: KanbanOptions = {},
  client: SupabaseClient<Database> = supabase,
): Promise<KanbanData> {
  requireWorkspace(workspaceId)

  let taskTypes: TaskType[] = []
  if (options.taskTypeId) {
    const singleType = await getTaskType(workspaceId, options.taskTypeId, client)
    taskTypes = [singleType]
  } else {
    const { data, error } = await client.from('task_types').select('*')
      .eq('workspace_id', workspaceId).eq('is_active', true).order('name')
    if (error) throw mapTaskError(error)
    taskTypes = data ?? []
  }

  const boards: KanbanBoard[] = []
  const allColumns: KanbanColumn[] = []

  const summaries = await listTaskSummaries(workspaceId, {
    ...options.filters,
    ...(options.taskTypeId ? { taskTypeId: options.taskTypeId } : {}),
    ...(options.departmentId ? { departmentId: options.departmentId } : {}),
  }, client)

  const tasksByStep = new Map<string, TaskSummary[]>()
  for (const summary of summaries) {
    const list = tasksByStep.get(summary.step.id) ?? []
    list.push(summary)
    tasksByStep.set(summary.step.id, list)
  }

  for (const taskType of taskTypes) {
    const workflow = await getWorkflowForTaskType(workspaceId, taskType.id, {}, client)
    let workflowDepartments = workflow.departments
    if (options.departmentId) {
      workflowDepartments = workflowDepartments.filter((d) => d.department.id === options.departmentId)
    }

    const boardDepartments: KanbanDepartmentSection[] = []
    const boardColumns: KanbanColumn[] = []

    for (const flowDept of workflowDepartments) {
      const departmentSteps: Array<{ step: WorkflowStep; tasks: TaskSummary[] }> = []

      for (const step of flowDept.steps) {
        const stepTasks = (tasksByStep.get(step.id) ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const column: KanbanColumn = {
          step,
          department: flowDept.department,
          taskType,
          tasks: stepTasks,
        }
        departmentSteps.push({ step, tasks: stepTasks })
        boardColumns.push(column)
        allColumns.push(column)
      }

      boardDepartments.push({
        department: flowDept.department,
        steps: departmentSteps,
      })
    }

    boards.push({
      taskType,
      departments: boardDepartments,
      columns: boardColumns,
    })
  }

  return {
    boards,
    columns: allColumns,
    tasks: summaries,
  }
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
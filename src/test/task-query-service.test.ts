import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { getTaskDetails, listArchivedTasks, listTasks, listTasksByProject } from '@/domains/tasks/queries/task-query-service'
import type { Database } from '@/lib/supabase/database.types'
import type { Task } from '@/domains/tasks/types'

const { relationMocks } = vi.hoisted(() => ({
  relationMocks: {
    getProject: vi.fn(),
    getClient: vi.fn(),
    getTaskType: vi.fn(),
    getWorkflowForTaskType: vi.fn(),
  },
}))

vi.mock('@/domains/projects/services/project-service', () => ({ getProject: relationMocks.getProject }))
vi.mock('@/domains/clients/services/client-service', () => ({ getClient: relationMocks.getClient }))
vi.mock('@/domains/workflows/queries/catalog-queries', () => ({ getTaskType: relationMocks.getTaskType }))
vi.mock('@/domains/workflows/queries/workflow-queries', () => ({ getWorkflowForTaskType: relationMocks.getWorkflowForTaskType }))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', workspace_id: 'workspace-1', project_id: 'project-1', task_type_id: 'type-1',
    workflow_step_id: 'step-1', parent_task_id: null, task_number: 1847, sprint_id: null,
    title: 'Editar vídeo', briefing: null,
    final_copy: null, priority: 'medium', assignee_member_id: 'member-1', reviewer_member_id: null,
    start_date: '2026-10-01', execution_date: null, due_date: '2026-10-10', publication_date: null, sort_order: 0,
    completed_at: null, archived_at: null, created_by_member_id: 'member-1', created_at: '', updated_at: '',
    ...overrides,
  }
}

function fluentQuery(response: unknown) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const query: Record<string, unknown> = {}
  const chain = (method: string) => vi.fn((...args: unknown[]) => {
    calls.push({ method, args })
    return query
  })
  for (const method of ['select', 'eq', 'is', 'not', 'lt', 'lte', 'gte', 'ilike', 'order']) {
    query[method] = chain(method)
  }
  query.maybeSingle = vi.fn(async () => response)
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)
  return { query, calls }
}

describe('consultas server-side de Task', () => {
  it('exclui arquivadas por padrão e escopa por workspace', async () => {
    const tasksQuery = fluentQuery({ data: [], error: null })
    const client = { from: vi.fn(() => tasksQuery.query) } as unknown as SupabaseClient<Database>

    await expect(listTasks('workspace-current', {}, client)).resolves.toEqual([])
    expect(tasksQuery.calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'workspace-current'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'is', args: ['archived_at', null] })
    expect(tasksQuery.calls).toContainEqual({ method: 'order', args: ['sort_order'] })
  })

  it('combina filtros de Projeto, Sprint, Tipo, Etapa, responsável/revisor e intervalos no banco', async () => {
    const tasksQuery = fluentQuery({ data: [], error: null })
    const client = { from: vi.fn(() => tasksQuery.query) } as unknown as SupabaseClient<Database>

    await listTasks('workspace-current', {
      projectId: 'project-1', sprintId: 'sprint-1', assigneeMemberId: 'member-1', reviewerMemberId: 'member-2',
      taskTypeId: 'type-1', workflowStepId: 'step-1', priority: 'high',
      dueDateFrom: '2026-10-01', dueDateTo: '2026-10-31',
      executionDateFrom: '2026-10-03', executionDateTo: '2026-10-29',
      publicationDateFrom: '2026-10-05', publicationDateTo: '2026-11-01',
      overdueOnly: true, overdueAsOf: '2026-10-15',
    }, client)

    for (const [column, value] of [
      ['workspace_id', 'workspace-current'], ['project_id', 'project-1'], ['sprint_id', 'sprint-1'],
      ['assignee_member_id', 'member-1'], ['reviewer_member_id', 'member-2'],
      ['task_type_id', 'type-1'], ['workflow_step_id', 'step-1'], ['priority', 'high'],
    ]) expect(tasksQuery.calls).toContainEqual({ method: 'eq', args: [column, value] })
    expect(tasksQuery.calls).toContainEqual({ method: 'gte', args: ['due_date', '2026-10-01'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'lte', args: ['due_date', '2026-10-31'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'gte', args: ['execution_date', '2026-10-03'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'lte', args: ['execution_date', '2026-10-29'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'gte', args: ['publication_date', '2026-10-05'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'lte', args: ['publication_date', '2026-11-01'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'lt', args: ['due_date', '2026-10-15'] })
    expect(tasksQuery.calls).toContainEqual({ method: 'is', args: ['completed_at', null] })
  })

  it('inclui arquivadas só quando explicitamente solicitado', async () => {
    const archivedQuery = fluentQuery({ data: [], error: null })
    const client = { from: vi.fn(() => archivedQuery.query) } as unknown as SupabaseClient<Database>
    await listArchivedTasks('workspace-current', {}, client)
    expect(archivedQuery.calls).toContainEqual({ method: 'not', args: ['archived_at', 'is', null] })
    expect(archivedQuery.calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'workspace-current'] })

    const projectQuery = fluentQuery({ data: [], error: null })
    const projectClient = { from: vi.fn(() => projectQuery.query) } as unknown as SupabaseClient<Database>
    await listTasksByProject('workspace-current', 'project-1', {}, projectClient)
    expect(projectQuery.calls).toContainEqual({ method: 'eq', args: ['project_id', 'project-1'] })
    expect(projectQuery.calls).toContainEqual({ method: 'is', args: ['archived_at', null] })
  })

  it('enriquece detalhe derivando Cliente do Projeto e Departamento da Etapa', async () => {
    vi.clearAllMocks()
    const taskRecord = makeTask()
    const taskQuery = fluentQuery({ data: taskRecord, error: null })
    const memberQuery = fluentQuery({ data: { id: 'member-1', workspace_id: 'workspace-1', user_id: 'user-1', role: 'member', status: 'active', job_title: null, created_at: '', updated_at: '' }, error: null })
    const profileQuery = fluentQuery({ data: { id: 'user-1', full_name: 'Ana Silva', avatar_url: 'https://cdn.example/avatar.png' }, error: null })
    const client = {
      from: vi.fn((table: string) => table === 'tasks' ? taskQuery.query : table === 'workspace_members' ? memberQuery.query : profileQuery.query),
    } as unknown as SupabaseClient<Database>

    relationMocks.getProject.mockResolvedValue({ id: 'project-1', workspace_id: 'workspace-1', client_id: 'client-1', name: 'Campanha' })
    relationMocks.getClient.mockResolvedValue({ id: 'client-1', workspace_id: 'workspace-1', display_name: 'Agência Time' })
    relationMocks.getTaskType.mockResolvedValue({ id: 'type-1', workspace_id: 'workspace-1', name: 'Vídeo', is_active: false })
    relationMocks.getWorkflowForTaskType.mockResolvedValue({
      taskType: { id: 'type-1', is_active: false },
      departments: [{
        association: { id: 'association-1', task_type_id: 'type-1', department_id: 'department-1', is_active: false },
        department: { id: 'department-1', workspace_id: 'workspace-1', name: 'Criação', is_active: false },
        steps: [{ id: 'step-1', task_type_department_id: 'association-1', name: 'Editar', position: 1, operational_nature: 'in_progress', is_active: false }],
      }],
    })

    const detail = await getTaskDetails('workspace-1', taskRecord.id, client)

    expect(relationMocks.getProject).toHaveBeenCalledWith('workspace-1', 'project-1', client)
    expect(relationMocks.getClient).toHaveBeenCalledWith('workspace-1', 'client-1', client)
    expect(detail).toMatchObject({
      client: { id: 'client-1', display_name: 'Agência Time' },
      project: { id: 'project-1', name: 'Campanha' },
      taskType: { id: 'type-1', name: 'Vídeo' },
      department: { id: 'department-1', name: 'Criação' },
      workflowStep: { id: 'step-1', name: 'Editar' },
      assignee: { member: { id: 'member-1' }, profile: { full_name: 'Ana Silva' } },
    })
    expect(detail.task).not.toHaveProperty('client_id')
    expect(detail.task).not.toHaveProperty('department_id')
  })
})
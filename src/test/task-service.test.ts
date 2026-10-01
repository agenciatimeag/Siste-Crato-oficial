import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveTask, assignTask, changeTaskType, createSubtask, createTask, moveTaskToDepartment, moveTaskToStep, reorderTasksInProject, restoreTask, setTaskReviewer, setTaskSortOrder, updateTask } from '@/domains/tasks/services/task-service'
import type { Database } from '@/lib/supabase/database.types'
import type { Task } from '@/domains/tasks/types'

const { workflowMocks } = vi.hoisted(() => ({
  workflowMocks: {
    resolveWorkflowPosition: vi.fn(),
    resolveDepartmentChange: vi.fn(),
    resolveTaskTypeChange: vi.fn(),
    getWorkflowForTaskType: vi.fn(),
  },
}))

vi.mock('@/domains/workflows/queries/workflow-queries', () => workflowMocks)

const projectId = 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3'
const otherProjectId = '8ce8dce5-e690-4f28-86b3-327ea393cd2f'
const taskTypeId = '8a6bd813-03e2-4f96-a461-7439436b290a'
const taskId = 'b8f3b2f7-8178-4d50-a26c-06ee35f2ce01'
const memberId = '94e3c694-f2af-466b-ac3c-d9b84c5b27c4'
const secondDepartmentId = 'a14e975f-8951-4eec-8bc5-986e4de50b03'
const firstStepId = '8c9d3505-c067-477b-854f-7c6f048f41de'
const secondStepId = 'da6f6464-8ab0-465e-bf75-7fc511354e31'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: taskId, workspace_id: 'workspace-1', project_id: projectId, task_type_id: taskTypeId,
    workflow_step_id: firstStepId, parent_task_id: null, title: 'Criar vídeo', briefing: null,
    final_copy: null, priority: 'low', assignee_member_id: null, reviewer_member_id: null,
    start_date: null, due_date: null, publication_date: null, sort_order: 0, completed_at: null,
    archived_at: null, created_by_member_id: 'member-1', created_at: '', updated_at: '',
    ...overrides,
  }
}

function fluentQuery(response: unknown, inserts: unknown[] = [], updates: unknown[] = []) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const query: Record<string, unknown> = {}
  const chain = (method: string) => vi.fn((...args: unknown[]) => {
    calls.push({ method, args })
    return query
  })
  query.select = chain('select')
  query.eq = chain('eq')
  query.is = chain('is')
  query.not = chain('not')
  query.lt = chain('lt')
  query.lte = chain('lte')
  query.gte = chain('gte')
  query.ilike = chain('ilike')
  query.order = chain('order')
  query.insert = vi.fn((values: unknown) => {
    inserts.push(values)
    calls.push({ method: 'insert', args: [values] })
    return query
  })
  query.update = vi.fn((values: unknown) => {
    updates.push(values)
    calls.push({ method: 'update', args: [values] })
    return query
  })
  query.maybeSingle = vi.fn(async () => response)
  query.single = vi.fn(async () => response)
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)
  return { query, calls }
}

function mockClient(queries: Record<string, ReturnType<typeof fluentQuery>[]>) {
  const calls: string[] = []
  const client = {
    from: vi.fn((table: string) => {
      calls.push(table)
      const query = queries[table]?.shift()
      if (!query) throw new Error(`Unexpected Supabase table: ${table}`)
      return query.query
    }),
  } as unknown as SupabaseClient<Database>
  return { client, calls }
}

function projectQuery(project = { id: projectId, workspace_id: 'workspace-1', client_id: 'client-1' }) {
  return fluentQuery({ data: project, error: null })
}

function workflowPosition(workflowStepId = firstStepId, departmentId = 'department-1', nature: 'todo' | 'in_progress' | 'complete' = 'todo') {
  const step = {
    id: workflowStepId, workspace_id: 'workspace-1', task_type_department_id: 'association-1',
    name: 'Editar', position: 1, operational_nature: nature, is_internal_review: false,
    is_external_review: false, is_revision: false, starts_timesheet: false, stops_timesheet: false,
    estimated_minutes: null, is_active: true, created_at: '', updated_at: '',
  }
  const department = { id: departmentId, workspace_id: 'workspace-1', name: 'Criação', description: null, is_active: true, created_at: '', updated_at: '' }
  const association = { id: 'association-1', workspace_id: 'workspace-1', task_type_id: taskTypeId, department_id: departmentId, position: 1, is_active: true, created_at: '', updated_at: '' }
  return { workflowStep: step, department, association }
}

function workflowFor(stepId = firstStepId, departmentId = 'department-1') {
  const position = workflowPosition(stepId, departmentId)
  return {
    taskType: { id: taskTypeId, workspace_id: 'workspace-1', name: 'Vídeo', description: null, is_active: true, created_at: '', updated_at: '' },
    departments: [{
      association: position.association,
      department: position.department,
      steps: [position.workflowStep],
    }],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  workflowMocks.resolveWorkflowPosition.mockResolvedValue(workflowPosition())
  workflowMocks.resolveDepartmentChange.mockResolvedValue(workflowPosition(secondStepId, 'department-2', 'in_progress'))
  workflowMocks.resolveTaskTypeChange.mockResolvedValue(workflowPosition(secondStepId, 'department-2', 'in_progress'))
  workflowMocks.getWorkflowForTaskType.mockImplementation(async (_workspaceId: string, typeId: string) =>
    workflowFor(firstStepId, typeId === taskTypeId ? 'department-1' : 'department-2'),
  )
})

describe('criação e integridade da tarefa', () => {
  it('cria tarefa com a primeira posição resolvida e sem client_id/department_id persistidos', async () => {
    const insertedTasks: unknown[] = []
    const insertedEvents: unknown[] = []
    const resultTask = makeTask()
    const db = mockClient({
      projects: [projectQuery()],
      tasks: [fluentQuery({ data: resultTask, error: null }, insertedTasks)],
      activity_log: [fluentQuery({ error: null }, insertedEvents)],
    })

    const result = await createTask('workspace-1', {
      project_id: projectId,
      task_type_id: taskTypeId,
      title: 'Criar vídeo',
    }, 'member-1', db.client)

    expect(result).toEqual(resultTask)
    expect(workflowMocks.resolveWorkflowPosition).toHaveBeenCalledWith('workspace-1', {
      taskTypeId,
      departmentId: undefined,
      workflowStepId: undefined,
    }, db.client)
    expect(insertedTasks).toHaveLength(1)
    expect(insertedTasks[0]).toMatchObject({
      workspace_id: 'workspace-1', project_id: projectId, task_type_id: taskTypeId,
      workflow_step_id: firstStepId, created_by_member_id: 'member-1',
    })
    expect(insertedTasks[0]).not.toHaveProperty('client_id')
    expect(insertedTasks[0]).not.toHaveProperty('department_id')
    expect(insertedEvents).toHaveLength(1)
    expect(insertedEvents[0]).toMatchObject({ entity_type: 'task', entity_id: resultTask.id, action: 'task.created' })
  })

  it('usa a primeira etapa do Departamento informado ou mantém uma etapa explícita válida', async () => {
    const dbWithDepartment = mockClient({
      projects: [projectQuery()],
      tasks: [fluentQuery({ data: makeTask({ workflow_step_id: secondStepId }), error: null })],
      activity_log: [fluentQuery({ error: null })],
    })
    await createTask('workspace-1', {
      project_id: projectId, task_type_id: taskTypeId, department_id: secondDepartmentId, title: 'Por Departamento',
    }, null, dbWithDepartment.client)
    expect(workflowMocks.resolveWorkflowPosition).toHaveBeenLastCalledWith('workspace-1', {
      taskTypeId, departmentId: secondDepartmentId, workflowStepId: undefined,
    }, dbWithDepartment.client)

    const dbWithStep = mockClient({
      projects: [projectQuery()],
      tasks: [fluentQuery({ data: makeTask({ workflow_step_id: secondStepId }), error: null })],
      activity_log: [fluentQuery({ error: null })],
    })
    await createTask('workspace-1', {
      project_id: projectId, task_type_id: taskTypeId, department_id: secondDepartmentId,
      workflow_step_id: secondStepId, title: 'Etapa explícita',
    }, null, dbWithStep.client)
    expect(workflowMocks.resolveWorkflowPosition).toHaveBeenLastCalledWith('workspace-1', {
      taskTypeId, departmentId: secondDepartmentId, workflowStepId: secondStepId,
    }, dbWithStep.client)
  })

  it('rejeita Tipo sem workflow e etapa inválida antes de inserir', async () => {
    for (const resolverError of [
      Object.assign(new Error('sem fluxo'), { code: 'WORKFLOW_NOT_CONFIGURED' }),
      Object.assign(new Error('etapa inválida'), { code: 'INVALID_WORKFLOW_POSITION' }),
    ]) {
      workflowMocks.resolveWorkflowPosition.mockRejectedValueOnce(resolverError)
      const db = mockClient({ projects: [projectQuery()] })
      await expect(createTask('workspace-1', {
        project_id: projectId, task_type_id: taskTypeId, title: 'Inválida',
      }, null, db.client)).rejects.toBe(resolverError)
      expect(db.calls).not.toContain('tasks')
    }
  })

  it('rejeita Projeto de outro workspace e atribuições de membros inativos', async () => {
    const wrongProject = mockClient({ projects: [fluentQuery({ data: null, error: null })] })
    await expect(createTask('workspace-1', {
      project_id: projectId, task_type_id: taskTypeId, title: 'Projeto externo',
    }, null, wrongProject.client)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
    expect(wrongProject.calls).not.toContain('tasks')

    for (const field of ['assignee_member_id', 'reviewer_member_id'] as const) {
      const memberQuery = fluentQuery({ data: null, error: null })
      const db = mockClient({ projects: [projectQuery()], workspace_members: [memberQuery] })
      await expect(createTask('workspace-1', {
        project_id: projectId,
        task_type_id: taskTypeId,
        title: 'Membro inativo',
        [field]: memberId,
      }, null, db.client)).rejects.toMatchObject({ code: 'WORKSPACE_MEMBER_NOT_ACTIVE' })
      expect(memberQuery.calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'workspace-1'] })
      expect(db.calls).not.toContain('tasks')
    }
  })

  it('rejeita subtarefa de outro Projeto e cria subtarefa válida derivando o Projeto do pai', async () => {
    const parent = makeTask({ project_id: projectId })
    const invalid = mockClient({ tasks: [fluentQuery({ data: parent, error: null })] })
    await expect(createSubtask('workspace-1', parent.id, {
      project_id: otherProjectId, task_type_id: taskTypeId, title: 'Projeto divergente',
    }, null, invalid.client)).rejects.toMatchObject({ code: 'PARENT_TASK_MUST_SHARE_PROJECT' })
    expect(invalid.calls).not.toContain('projects')

    const inserts: unknown[] = []
    const valid = mockClient({
      tasks: [
        fluentQuery({ data: parent, error: null }),
        fluentQuery({ data: parent, error: null }),
        fluentQuery({ data: makeTask({ id: 'subtask-1', parent_task_id: parent.id }), error: null }, inserts),
      ],
      projects: [projectQuery()],
      activity_log: [fluentQuery({ error: null })],
    })
    await createSubtask('workspace-1', parent.id, { task_type_id: taskTypeId, title: 'Subtarefa' }, null, valid.client)
    expect(inserts[0]).toMatchObject({ project_id: projectId, parent_task_id: parent.id })
  })
})

describe('transições centralizadas e histórico', () => {
  it('move para etapa válida em uma escrita e registra apenas task.workflow_changed', async () => {
    const current = makeTask({ workflow_step_id: firstStepId })
    const next = makeTask({ workflow_step_id: secondStepId })
    const updates: unknown[] = []
    const events: unknown[] = []
    workflowMocks.resolveWorkflowPosition.mockResolvedValueOnce(workflowPosition(secondStepId, secondDepartmentId, 'in_progress'))
    const db = mockClient({
      tasks: [fluentQuery({ data: current, error: null }), fluentQuery({ data: next, error: null }, [], updates)],
      activity_log: [fluentQuery({ error: null }, events)],
    })

    const result = await moveTaskToStep('workspace-1', current.id, secondStepId, 'member-1', db.client)
    expect(result.workflow_step_id).toBe(secondStepId)
    expect(updates).toEqual([{ workflow_step_id: secondStepId }])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ entity_type: 'task', action: 'task.workflow_changed', actor_member_id: 'member-1' })
  })

  it('não escreve nem registra histórico quando uma etapa de outro Tipo é rejeitada', async () => {
    const current = makeTask()
    const db = mockClient({ tasks: [fluentQuery({ data: current, error: null })] })
    workflowMocks.resolveWorkflowPosition.mockRejectedValueOnce(Object.assign(
      new Error('Esta etapa não pertence ao fluxo deste tipo de tarefa.'),
      { code: 'INVALID_WORKFLOW_POSITION' },
    ))
    await expect(moveTaskToStep('workspace-1', current.id, 'step-other-type', null, db.client))
      .rejects.toMatchObject({ code: 'INVALID_WORKFLOW_POSITION' })
    expect(db.calls).not.toContain('activity_log')
    expect(db.calls.filter((table) => table === 'tasks')).toHaveLength(1)
  })

  it('resolve mudança de Departamento e atualiza só workflow_step_id', async () => {
    const current = makeTask({ workflow_step_id: firstStepId })
    const next = makeTask({ workflow_step_id: secondStepId })
    const updates: unknown[] = []
    const db = mockClient({
      tasks: [fluentQuery({ data: current, error: null }), fluentQuery({ data: next, error: null }, [], updates)],
      activity_log: [fluentQuery({ error: null })],
    })
    await moveTaskToDepartment('workspace-1', current.id, 'department-2', undefined, null, db.client)
    expect(workflowMocks.resolveDepartmentChange).toHaveBeenCalledWith('workspace-1', taskTypeId, 'department-2', undefined, db.client)
    expect(updates).toEqual([{ workflow_step_id: secondStepId }])
  })

  it('muda Tipo e Etapa numa única escrita e um único evento task.type_changed', async () => {
    const current = makeTask({ workflow_step_id: firstStepId })
    const next = makeTask({ task_type_id: 'type-new', workflow_step_id: secondStepId })
    const updates: unknown[] = []
    const events: unknown[] = []
    const db = mockClient({
      tasks: [fluentQuery({ data: current, error: null }), fluentQuery({ data: next, error: null }, [], updates)],
      activity_log: [fluentQuery({ error: null }, events)],
    })
    await changeTaskType('workspace-1', current.id, 'type-new', 'member-1', db.client)
    expect(workflowMocks.resolveTaskTypeChange).toHaveBeenCalledWith('workspace-1', 'type-new', firstStepId, db.client)
    expect(updates).toEqual([{ task_type_id: 'type-new', workflow_step_id: secondStepId }])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ entity_type: 'task', action: 'task.type_changed' })
  })

  it('mantém a Etapa quando o motor confirma que ela ainda vale para o Tipo novo', async () => {
    const current = makeTask({ workflow_step_id: firstStepId })
    const next = makeTask({ task_type_id: 'type-new', workflow_step_id: firstStepId })
    const updates: unknown[] = []
    const db = mockClient({
      tasks: [fluentQuery({ data: current, error: null }), fluentQuery({ data: next, error: null }, [], updates)],
      activity_log: [fluentQuery({ error: null })],
    })
    workflowMocks.resolveTaskTypeChange.mockResolvedValueOnce(workflowPosition(firstStepId, 'department-new', 'in_progress'))

    const result = await changeTaskType('workspace-1', current.id, 'type-new', null, db.client)
    expect(result.workflow_step_id).toBe(firstStepId)
    expect(updates).toEqual([{ task_type_id: 'type-new', workflow_step_id: firstStepId }])
  })

  it('faz update parcial sem limpar campos omitidos e ignora update vazio sem evento', async () => {
    const current = makeTask({ briefing: 'Briefing preservado' })
    const updated = makeTask({ briefing: 'Briefing preservado', priority: 'high' })
    const updates: unknown[] = []
    const events: unknown[] = []
    const db = mockClient({
      tasks: [fluentQuery({ data: current, error: null }), fluentQuery({ data: updated, error: null }, [], updates)],
      activity_log: [fluentQuery({ error: null }, events)],
    })
    await updateTask('workspace-1', current.id, { priority: 'high' }, 'member-1', db.client)
    expect(updates).toEqual([{ priority: 'high' }])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ action: 'task.priority_changed', entity_type: 'task' })

    const emptyUpdate = mockClient({ tasks: [fluentQuery({ data: current, error: null })] })
    await updateTask('workspace-1', current.id, {}, null, emptyUpdate.client)
    expect(emptyUpdate.calls).toEqual(['tasks'])
  })

  it('valida datas parciais contra valores persistidos antes de gravar', async () => {
    const current = makeTask({ start_date: '2026-10-10', due_date: '2026-10-20' })
    const db = mockClient({ tasks: [fluentQuery({ data: current, error: null })] })
    await expect(updateTask('workspace-1', current.id, { due_date: '2026-10-09' }, null, db.client))
      .rejects.toMatchObject({ name: 'ZodError' })
    expect(db.calls).toEqual(['tasks'])
  })

  it('registra múltiplas datas alteradas em um único evento task.dates_changed', async () => {
    const current = makeTask()
    const updated = makeTask({ start_date: '2026-10-01', due_date: '2026-10-10', publication_date: '2026-10-11' })
    const events: unknown[] = []
    const db = mockClient({
      tasks: [fluentQuery({ data: current, error: null }), fluentQuery({ data: updated, error: null })],
      activity_log: [fluentQuery({ error: null }, events)],
    })

    await updateTask('workspace-1', current.id, {
      start_date: '2026-10-01', due_date: '2026-10-10', publication_date: '2026-10-11',
    }, null, db.client)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ action: 'task.dates_changed', entity_type: 'task' })
  })

  it('altera responsável e revisor como papéis independentes após validar membros ativos', async () => {
    const current = makeTask()
    const assigned = makeTask({ assignee_member_id: memberId })
    const reviewed = makeTask({ reviewer_member_id: memberId })
    const events: unknown[] = []
    const updates: unknown[] = []
    const assignmentQuery = fluentQuery({ data: { id: memberId }, error: null })
    const reviewerQuery = fluentQuery({ data: { id: memberId }, error: null })
    const db = mockClient({
      tasks: [
        fluentQuery({ data: current, error: null }), fluentQuery({ data: assigned, error: null }, [], updates),
        fluentQuery({ data: assigned, error: null }), fluentQuery({ data: reviewed, error: null }, [], updates),
      ],
      workspace_members: [assignmentQuery, reviewerQuery],
      activity_log: [fluentQuery({ error: null }, events), fluentQuery({ error: null }, events)],
    })

    await assignTask('workspace-1', current.id, memberId, 'member-1', db.client)
    await setTaskReviewer('workspace-1', current.id, memberId, 'member-1', db.client)

    expect(updates).toEqual([{ assignee_member_id: memberId }, { reviewer_member_id: memberId }])
    expect(events).toHaveLength(2)
    expect(events.map((event) => (event as { action: string }).action)).toEqual([
      'task.assignee_changed', 'task.reviewer_changed',
    ])
    for (const query of [assignmentQuery, reviewerQuery]) {
      expect(query.query.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
      expect(query.query.eq).toHaveBeenCalledWith('status', 'active')
    }
  })

  it('arquiva/restaura sem excluir e registra um evento por transição', async () => {
    const current = makeTask()
    const archived = makeTask({ archived_at: '2026-10-01T10:00:00Z' })
    const restored = makeTask()
    const updates: unknown[] = []
    const events: unknown[] = []
    const db = mockClient({
      tasks: [
        fluentQuery({ data: current, error: null }), fluentQuery({ data: archived, error: null }, [], updates),
        fluentQuery({ data: archived, error: null }), fluentQuery({ data: restored, error: null }, [], updates),
      ],
      activity_log: [fluentQuery({ error: null }, events), fluentQuery({ error: null }, events)],
    })
    await archiveTask('workspace-1', current.id, null, db.client)
    await restoreTask('workspace-1', current.id, null, db.client)
    expect(updates).toHaveLength(2)
    expect(events).toHaveLength(2)
    expect(events.map((event) => (event as { action: string }).action)).toEqual(['task.archived', 'task.restored'])
  })

  it('atualiza sort_order sem tocar no workflow e registra task.updated', async () => {
    const current = makeTask({ workflow_step_id: firstStepId, sort_order: 1 })
    const updated = makeTask({ workflow_step_id: firstStepId, sort_order: 4 })
    const updates: unknown[] = []
    const events: unknown[] = []
    const db = mockClient({
      tasks: [fluentQuery({ data: current, error: null }), fluentQuery({ data: updated, error: null }, [], updates)],
      activity_log: [fluentQuery({ error: null }, events)],
    })
    await setTaskSortOrder('workspace-1', current.id, 4, null, db.client)
    expect(updates).toEqual([{ sort_order: 4 }])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ action: 'task.updated', metadata: { changed_fields: ['sort_order'] } })
  })

  it('reordena tarefas somente dentro do Projeto e não move etapas do workflow', async () => {
    const first = makeTask({ id: taskId, sort_order: 0, workflow_step_id: firstStepId })
    const secondId = '3f9c244f-f630-45d1-a446-e9245ef34d9b'
    const second = makeTask({ id: secondId, sort_order: 1, workflow_step_id: secondStepId })
    const updates: unknown[] = []
    const events: unknown[] = []
    const db = mockClient({
      projects: [projectQuery()],
      tasks: [
        fluentQuery({ data: [first, second], error: null }),
        fluentQuery({ data: { ...second, sort_order: 0 }, error: null }, [], updates),
        fluentQuery({ data: { ...first, sort_order: 1 }, error: null }, [], updates),
      ],
      activity_log: [fluentQuery({ error: null }, events), fluentQuery({ error: null }, events)],
    })

    const reordered = await reorderTasksInProject('workspace-1', projectId, [secondId, taskId], null, db.client)
    expect(reordered.map(({ sort_order }) => sort_order)).toEqual([0, 1])
    expect(updates).toEqual([{ sort_order: 0 }, { sort_order: 1 }])
    expect(events).toHaveLength(2)
    expect(db.calls.filter((table) => table === 'projects')).toHaveLength(1)
    expect(workflowMocks.resolveWorkflowPosition).not.toHaveBeenCalled()
  })
})
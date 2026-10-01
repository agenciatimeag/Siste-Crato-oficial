import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  enrichTaskSummaries,
  getKanbanData,
  getTaskByNumber,
  getTaskDashboardData,
  listCalendarTasks,
  listTasks,
  listTaskSummaries,
  resolveTaskState,
} from '@/domains/tasks/queries/task-query-service'
import { taskSavedViewSettingsSchema } from '@/domains/tasks/schemas/task-saved-view-schema'
import type { Database } from '@/lib/supabase/database.types'
import type { OperationalNature } from '@/domains/workflows/types'
import type { Task } from '@/domains/tasks/types'

type MockDatabase = {
  tasks?: Task[]
  projects?: Array<{ id: string; workspace_id: string; client_id: string; name: string }>
  clients?: Array<{ id: string; workspace_id: string; display_name: string }>
  task_types?: Array<{ id: string; workspace_id: string; name: string; is_active: boolean }>
  departments?: Array<{ id: string; workspace_id: string; name: string }>
  task_type_departments?: Array<{ id: string; workspace_id: string; task_type_id: string; department_id: string; position: number; is_active: boolean }>
  workflow_steps?: Array<{ id: string; workspace_id: string; task_type_department_id: string; name: string; position: number; operational_nature: OperationalNature; is_internal_review: boolean; is_external_review: boolean; is_active: boolean }>
  workspace_members?: Array<{ id: string; workspace_id: string; user_id: string; role: 'owner' | 'admin' | 'member'; status: 'active' | 'inactive'; job_title: string | null; created_at: string; updated_at: string }>
  profiles?: Array<{ id: string; full_name: string; avatar_url: string | null; phone: string | null; created_at: string; updated_at: string }>
  sprints?: Array<{ id: string; workspace_id: string; name: string; is_active: boolean }>
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    workspace_id: 'ws-1',
    project_id: 'proj-1',
    task_type_id: 'type-1',
    workflow_step_id: 'step-1',
    parent_task_id: null,
    task_number: 1847,
    sprint_id: null,
    title: 'Gravar podcast de marketing',
    briefing: 'Texto do briefing',
    final_copy: 'Texto final da copy',
    priority: 'medium',
    assignee_member_id: 'member-1',
    reviewer_member_id: 'member-2',
    start_date: '2026-10-01',
    execution_date: '2026-10-05',
    due_date: '2026-10-15',
    publication_date: '2026-10-20',
    sort_order: 0,
    completed_at: null,
    archived_at: null,
    created_by_member_id: 'member-1',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    ...overrides,
  }
}

function createMockClient(data: MockDatabase) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = []
  const fromCalls: string[] = []

  const from = (table: keyof MockDatabase) => {
    fromCalls.push(table)
    let rows = [...(data[table] ?? [])] as Array<Record<string, unknown>>
    const query: Record<string, unknown> = {}
    const self = query

    query.select = vi.fn((columns = '*') => {
      calls.push({ table, method: 'select', args: [columns] })
      return self
    })

    query.eq = vi.fn((column: string, value: unknown) => {
      calls.push({ table, method: 'eq', args: [column, value] })
      rows = rows.filter((r) => r[column] === value)
      return self
    })

    query.is = vi.fn((column: string, value: unknown) => {
      calls.push({ table, method: 'is', args: [column, value] })
      rows = rows.filter((r) => r[column] === value)
      return self
    })

    query.not = vi.fn((column: string, op: string, value: unknown) => {
      calls.push({ table, method: 'not', args: [column, op, value] })
      if (op === 'is') {
        rows = rows.filter((r) => r[column] !== value)
      }
      return self
    })

    query.in = vi.fn((column: string, values: unknown[]) => {
      calls.push({ table, method: 'in', args: [column, values] })
      const set = new Set(values)
      rows = rows.filter((r) => set.has(r[column]))
      return self
    })

    query.gte = vi.fn((column: string, value: string) => {
      calls.push({ table, method: 'gte', args: [column, value] })
      rows = rows.filter((r) => r[column] && (r[column] as string) >= value)
      return self
    })

    query.lte = vi.fn((column: string, value: string) => {
      calls.push({ table, method: 'lte', args: [column, value] })
      rows = rows.filter((r) => r[column] && (r[column] as string) <= value)
      return self
    })

    query.lt = vi.fn((column: string, value: string) => {
      calls.push({ table, method: 'lt', args: [column, value] })
      rows = rows.filter((r) => r[column] && (r[column] as string) < value)
      return self
    })

    query.ilike = vi.fn((column: string, pattern: string) => {
      calls.push({ table, method: 'ilike', args: [column, pattern] })
      const clean = pattern.replace(/%/g, '').toLowerCase()
      rows = rows.filter((r) => typeof r[column] === 'string' && (r[column] as string).toLowerCase().includes(clean))
      return self
    })

    query.or = vi.fn((expression: string) => {
      calls.push({ table, method: 'or', args: [expression] })
      const parts = (expression as string).split(',')
      rows = rows.filter((r) => {
        return parts.some((part) => {
          if (part.startsWith('task_number.eq.')) {
            const val = Number(part.replace('task_number.eq.', ''))
            return r.task_number === val
          }
          if (part.startsWith('title.ilike.')) {
            const pat = part.replace('title.ilike.', '').replace(/%/g, '').toLowerCase()
            return typeof r.title === 'string' && (r.title as string).toLowerCase().includes(pat)
          }
          if (part.startsWith('project_id.in.')) {
            const raw = part.replace('project_id.in.(', '').replace(')', '')
            const ids = raw.split(',').map((id) => id.trim())
            return ids.includes(r.project_id as string)
          }
          return false
        })
      })
      return self
    })

    query.order = vi.fn((column: string) => {
      calls.push({ table, method: 'order', args: [column] })
      return self
    })

    query.maybeSingle = vi.fn(async () => ({
      data: rows[0] ?? null,
      error: null,
    }))

    query.then = (resolve: (val: unknown) => unknown, reject: (err: unknown) => unknown) => {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
    }

    return query
  }

  return {
    client: { from: vi.fn(from) } as unknown as SupabaseClient<Database>,
    calls,
    fromCalls,
  }
}

describe('camada de leitura operacional de Tasks', () => {
  it('client filter: deriva projetos do cliente no workspace e filtra tasks sem client_id na tabela tasks', async () => {
    const taskA = makeTask({ id: 'task-a', project_id: 'proj-1' })
    const taskB = makeTask({ id: 'task-b', project_id: 'proj-2' })
    const { client, calls } = createMockClient({
      projects: [
        { id: 'proj-1', workspace_id: 'ws-1', client_id: 'client-1', name: 'Campanha A' },
        { id: 'proj-2', workspace_id: 'ws-1', client_id: 'client-2', name: 'Campanha B' },
      ],
      tasks: [taskA, taskB],
    })

    const results = await listTasks('ws-1', { clientId: 'client-1' }, client)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('task-a')
    expect(results[0]).not.toHaveProperty('client_id')
    expect(calls).toContainEqual({ table: 'projects', method: 'eq', args: ['client_id', 'client-1'] })
    expect(calls).toContainEqual({ table: 'tasks', method: 'in', args: ['project_id', ['proj-1']] })

    // Quando cliente não possui projetos, retorna vazio
    const emptyResults = await listTasks('ws-1', { clientId: 'client-sem-projeto' }, client)
    expect(emptyResults).toEqual([])
  })

  it('department filter: deriva etapas das associações do departamento no workspace sem department_id na tabela tasks', async () => {
    const taskA = makeTask({ id: 'task-a', workflow_step_id: 'step-1' })
    const taskB = makeTask({ id: 'task-b', workflow_step_id: 'step-2' })
    const { client, calls } = createMockClient({
      task_type_departments: [
        { id: 'ttd-1', workspace_id: 'ws-1', task_type_id: 'type-1', department_id: 'dept-criação', position: 1, is_active: true },
      ],
      workflow_steps: [
        { id: 'step-1', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Roteiro', position: 1, operational_nature: 'todo', is_internal_review: false, is_external_review: false, is_active: true },
        { id: 'step-2', workspace_id: 'ws-1', task_type_department_id: 'ttd-outro', name: 'Outro', position: 2, operational_nature: 'in_progress', is_internal_review: false, is_external_review: false, is_active: true },
      ],
      tasks: [taskA, taskB],
    })

    const results = await listTasks('ws-1', { departmentId: 'dept-criação' }, client)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('task-a')
    expect(results[0]).not.toHaveProperty('department_id')
    expect(calls).toContainEqual({ table: 'task_type_departments', method: 'eq', args: ['department_id', 'dept-criação'] })
    expect(calls).toContainEqual({ table: 'tasks', method: 'in', args: ['workflow_step_id', ['step-1']] })
  })

  it('workflow step filter: filtra tasks diretamente por workflowStepId', async () => {
    const taskA = makeTask({ id: 'task-a', workflow_step_id: 'step-10' })
    const { client, calls } = createMockClient({ tasks: [taskA] })

    const results = await listTasks('ws-1', { workflowStepId: 'step-10' }, client)
    expect(results).toEqual([taskA])
    expect(calls).toContainEqual({ table: 'tasks', method: 'eq', args: ['workflow_step_id', 'step-10'] })
  })

  it('ativas: filtra tasks com archived_at null e completed_at null', async () => {
    const activeTask = makeTask({ id: 'task-active', completed_at: null, archived_at: null })
    const completedTask = makeTask({ id: 'task-completed', completed_at: '2026-10-01T12:00:00Z', archived_at: null })
    const archivedTask = makeTask({ id: 'task-archived', completed_at: null, archived_at: '2026-10-01T12:00:00Z' })
    const { client, calls } = createMockClient({ tasks: [activeTask, completedTask, archivedTask] })

    const results = await listTasks('ws-1', { state: 'active' }, client)
    expect(results).toEqual([activeTask])
    expect(calls).toContainEqual({ table: 'tasks', method: 'is', args: ['archived_at', null] })
    expect(calls).toContainEqual({ table: 'tasks', method: 'is', args: ['completed_at', null] })

    // Suporta alias em português 'ativas'
    expect(resolveTaskState({ state: 'active' })).toBe('active')
    const aliasResults = await listTasks('ws-1', { state: 'all' }, client)
    expect(aliasResults).toHaveLength(3)
  })

  it('concluídas: filtra tasks com archived_at null e completed_at not null sem confundir com archived_at', async () => {
    const activeTask = makeTask({ id: 'task-active', completed_at: null, archived_at: null })
    const completedTask = makeTask({ id: 'task-completed', completed_at: '2026-10-01T12:00:00Z', archived_at: null })
    const completedAndArchivedTask = makeTask({ id: 'task-comp-arch', completed_at: '2026-10-01T12:00:00Z', archived_at: '2026-10-02T12:00:00Z' })
    const { client, calls } = createMockClient({ tasks: [activeTask, completedTask, completedAndArchivedTask] })

    const results = await listTasks('ws-1', { state: 'completed' }, client)
    expect(results).toEqual([completedTask])
    expect(calls).toContainEqual({ table: 'tasks', method: 'is', args: ['archived_at', null] })
    expect(calls).toContainEqual({ table: 'tasks', method: 'not', args: ['completed_at', 'is', null] })
  })

  it('arquivadas: filtra tasks com archived_at not null independentemente de completed_at', async () => {
    const activeTask = makeTask({ id: 'task-active', archived_at: null })
    const archivedTask = makeTask({ id: 'task-archived', archived_at: '2026-10-02T12:00:00Z' })
    const { client, calls } = createMockClient({ tasks: [activeTask, archivedTask] })

    const results = await listTasks('ws-1', { state: 'archived' }, client)
    expect(results).toEqual([archivedTask])
    expect(calls).toContainEqual({ table: 'tasks', method: 'not', args: ['archived_at', 'is', null] })
  })

  it('todas: retorna ativas, concluídas e arquivadas sem filtro de completed_at nem archived_at', async () => {
    const active = makeTask({ id: 't1', completed_at: null, archived_at: null })
    const completed = makeTask({ id: 't2', completed_at: '2026-10-01T10:00:00Z', archived_at: null })
    const archived = makeTask({ id: 't3', completed_at: null, archived_at: '2026-10-01T10:00:00Z' })
    const { client, calls } = createMockClient({ tasks: [active, completed, archived] })

    const results = await listTasks('ws-1', { state: 'all' }, client)
    expect(results).toHaveLength(3)
    const taskCalls = calls.filter((c) => c.table === 'tasks')
    expect(taskCalls.some((c) => c.method === 'is' && c.args[0] === 'archived_at')).toBe(false)
    expect(taskCalls.some((c) => c.method === 'not' && c.args[0] === 'archived_at')).toBe(false)
  })

  it('search title: busca por title aplica filtro textual no título da tarefa', async () => {
    const taskA = makeTask({ id: 'task-a', title: 'Gravar podcast de vendas' })
    const taskB = makeTask({ id: 'task-b', title: 'Editar vídeo institucional' })
    const { client } = createMockClient({ tasks: [taskA, taskB] })

    const results = await listTasks('ws-1', { search: 'podcast' }, client)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('task-a')
  })

  it('search 1847: busca por 1847 encontra a tarefa pelo task_number', async () => {
    const taskA = makeTask({ id: 'task-a', task_number: 1847, title: 'Gravar podcast' })
    const taskB = makeTask({ id: 'task-b', task_number: 9999, title: 'Editar vídeo' })
    const { client } = createMockClient({ tasks: [taskA, taskB] })

    const searchPlain = await listTasks('ws-1', { search: '1847' }, client)
    expect(searchPlain).toHaveLength(1)
    expect(searchPlain[0].id).toBe('task-a')
  })

  it('search #1847: busca por #1847 encontra a mesma tarefa com prefixo de hash', async () => {
    const taskA = makeTask({ id: 'task-a', task_number: 1847, title: 'Gravar podcast' })
    const taskB = makeTask({ id: 'task-b', task_number: 9999, title: 'Editar vídeo' })
    const { client } = createMockClient({ tasks: [taskA, taskB] })

    const searchHash = await listTasks('ws-1', { search: '#1847' }, client)
    expect(searchHash).toHaveLength(1)
    expect(searchHash[0].id).toBe('task-a')
  })

  it('search project: busca por project encontra tarefas associadas ao projeto correspondente', async () => {
    const taskA = makeTask({ id: 'task-a', project_id: 'proj-1', title: 'Roteiro' })
    const taskB = makeTask({ id: 'task-b', project_id: 'proj-2', title: 'Gravação' })
    const { client } = createMockClient({
      projects: [
        { id: 'proj-1', workspace_id: 'ws-1', client_id: 'c-1', name: 'Lançamento Verão' },
        { id: 'proj-2', workspace_id: 'ws-1', client_id: 'c-1', name: 'Institucional 2026' },
      ],
      tasks: [taskA, taskB],
    })

    const results = await listTasks('ws-1', { search: 'Verão' }, client)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('task-a')
  })

  it('search client: busca por client encontra tarefas associadas ao cliente correspondente via projeto', async () => {
    const taskA = makeTask({ id: 'task-a', project_id: 'proj-1', title: 'Gravar chamada' })
    const taskB = makeTask({ id: 'task-b', project_id: 'proj-2', title: 'Gravar storie' })
    const { client } = createMockClient({
      clients: [
        { id: 'client-alfa', workspace_id: 'ws-1', display_name: 'Rede Alfa Odonto' },
      ],
      projects: [
        { id: 'proj-1', workspace_id: 'ws-1', client_id: 'client-alfa', name: 'Redes Sociais' },
        { id: 'proj-2', workspace_id: 'ws-1', client_id: 'outro-cliente', name: 'Redes Sociais Outro' },
      ],
      tasks: [taskA, taskB],
    })

    const results = await listTasks('ws-1', { search: 'Rede Alfa' }, client)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('task-a')
  })

  it('TaskSummary enrichment: enriquece dados em lote sem N+1 e omite dados pesados de detalhe', async () => {
    const task1 = makeTask({ id: 'task-1', task_number: 101, project_id: 'proj-1', sprint_id: 'sprint-1' })
    const task2 = makeTask({ id: 'task-2', task_number: 102, project_id: 'proj-1', sprint_id: null, reviewer_member_id: null })
    const { client, fromCalls } = createMockClient({
      tasks: [task1, task2],
      projects: [{ id: 'proj-1', workspace_id: 'ws-1', client_id: 'client-1', name: 'Campanha Black Friday' }],
      clients: [{ id: 'client-1', workspace_id: 'ws-1', display_name: 'Supermercado Central' }],
      task_types: [{ id: 'type-1', workspace_id: 'ws-1', name: 'Vídeo Promocional', is_active: true }],
      departments: [{ id: 'dept-1', workspace_id: 'ws-1', name: 'Audiovisual' }],
      task_type_departments: [{ id: 'ttd-1', workspace_id: 'ws-1', task_type_id: 'type-1', department_id: 'dept-1', position: 1, is_active: true }],
      workflow_steps: [{ id: 'step-1', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Colorização', position: 1, operational_nature: 'in_progress', is_internal_review: false, is_external_review: false, is_active: true }],
      workspace_members: [
        { id: 'member-1', workspace_id: 'ws-1', user_id: 'user-1', role: 'member', status: 'active', job_title: null, created_at: '', updated_at: '' },
        { id: 'member-2', workspace_id: 'ws-1', user_id: 'user-2', role: 'member', status: 'active', job_title: null, created_at: '', updated_at: '' },
      ],
      profiles: [
        { id: 'user-1', full_name: 'Lucas Editor', avatar_url: 'https://cdn/lucas.png', phone: null, created_at: '', updated_at: '' },
        { id: 'user-2', full_name: 'Camila Diretora', avatar_url: 'https://cdn/camila.png', phone: null, created_at: '', updated_at: '' },
      ],
      sprints: [{ id: 'sprint-1', workspace_id: 'ws-1', name: 'Sprint 24', is_active: true }],
    })

    const directEnriched = await enrichTaskSummaries('ws-1', [task1, task2], client)
    expect(directEnriched).toHaveLength(2)

    fromCalls.length = 0
    const summaries = await listTaskSummaries('ws-1', {}, client)
    expect(summaries).toHaveLength(2)

    const first = summaries[0]
    expect(first).toMatchObject({
      id: 'task-1',
      task_number: 101,
      title: 'Gravar podcast de marketing',
      priority: 'medium',
      project: { id: 'proj-1', name: 'Campanha Black Friday' },
      client: { id: 'client-1', name: 'Supermercado Central' },
      type: { id: 'type-1', name: 'Vídeo Promocional' },
      department: { id: 'dept-1', name: 'Audiovisual' },
      step: { id: 'step-1', name: 'Colorização', operational_nature: 'in_progress' },
      assignee: { id: 'member-1', nome: 'Lucas Editor', avatar: 'https://cdn/lucas.png' },
      reviewer: { id: 'member-2', nome: 'Camila Diretora', avatar: 'https://cdn/camila.png' },
      sprint: { id: 'sprint-1', name: 'Sprint 24' },
    })

    // Garante que briefing, final_copy, comments, checklist, files ou activity NÃO foram carregados
    expect(first).not.toHaveProperty('briefing')
    expect(first).not.toHaveProperty('final_copy')
    expect(first).not.toHaveProperty('comments')
    expect(first).not.toHaveProperty('checklist')
    expect(first).not.toHaveProperty('files')
    expect(first).not.toHaveProperty('activity')

    // Verifica que cada tabela relacional foi consultada em batch (no máximo 1 vez cada), sem N+1 por task
    const countTable = (t: string) => fromCalls.filter((name) => name === t).length
    expect(countTable('projects')).toBeLessThanOrEqual(1)
    expect(countTable('clients')).toBeLessThanOrEqual(1)
    expect(countTable('task_types')).toBeLessThanOrEqual(1)
    expect(countTable('workflow_steps')).toBeLessThanOrEqual(1)
    expect(countTable('workspace_members')).toBeLessThanOrEqual(1)
    expect(countTable('profiles')).toBeLessThanOrEqual(1)
  })

  it('workspace isolation: garante que busca por número e listagens não vazam tarefas de outro workspace', async () => {
    const taskWs1 = makeTask({ id: 't-1', workspace_id: 'ws-1', task_number: 1847 })
    const taskWs2 = makeTask({ id: 't-2', workspace_id: 'ws-2', task_number: 1847 })
    const { client } = createMockClient({ tasks: [taskWs1, taskWs2] })

    // No workspace ws-1, recupera t-1
    const found = await getTaskByNumber('ws-1', 1847, client)
    expect(found.id).toBe('t-1')

    // No workspace ws-3, task 1847 não existe e deve lançar TASK_NOT_FOUND
    await expect(getTaskByNumber('ws-3', 1847, client)).rejects.toMatchObject({
      code: 'TASK_NOT_FOUND',
    })
  })

  it('Saved View clientId: valida filtro de clientId no schema de visualizações salvas', () => {
    const parsed = taskSavedViewSettingsSchema.parse({
      filters: { clientId: 'client-123' },
    })
    expect(parsed.filters?.clientId).toBe('client-123')
  })

  it('Saved View departmentId: valida filtro de departmentId no schema de visualizações salvas', () => {
    const parsed = taskSavedViewSettingsSchema.parse({
      filters: { departmentId: 'department-456' },
    })
    expect(parsed.filters?.departmentId).toBe('department-456')
  })

  it('colorMode client: valida suporte a colorMode client no schema e rejeita modos inválidos', () => {
    const parsed = taskSavedViewSettingsSchema.parse({
      colorMode: 'client',
      grouping: 'client',
    })
    expect(parsed.colorMode).toBe('client')
    expect(parsed.grouping).toBe('client')

    expect(() => taskSavedViewSettingsSchema.parse({ colorMode: 'invalid_mode' })).toThrow()
  })

  it('Calendar por execution_date: filtra intervalo por execution_date', async () => {
    const task1 = makeTask({ id: 't-1', execution_date: '2026-10-10' })
    const task2 = makeTask({ id: 't-2', execution_date: '2026-11-15' })
    const { client, calls } = createMockClient({
      tasks: [task1, task2],
      projects: [{ id: 'proj-1', workspace_id: 'ws-1', client_id: 'c-1', name: 'P1' }],
      clients: [{ id: 'c-1', workspace_id: 'ws-1', display_name: 'C1' }],
      task_types: [{ id: 'type-1', workspace_id: 'ws-1', name: 'T1', is_active: true }],
      departments: [],
      task_type_departments: [],
      workflow_steps: [],
      workspace_members: [],
      profiles: [],
      sprints: [],
    })

    const results = await listCalendarTasks('ws-1', {
      dateMode: 'execution_date',
      rangeStart: '2026-10-01',
      rangeEnd: '2026-10-31',
    }, client)

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('t-1')
    expect(calls).toContainEqual({ table: 'tasks', method: 'gte', args: ['execution_date', '2026-10-01'] })
    expect(calls).toContainEqual({ table: 'tasks', method: 'lte', args: ['execution_date', '2026-10-31'] })
  })

  it('Calendar por due_date: filtra intervalo por due_date', async () => {
    const task1 = makeTask({ id: 't-1', due_date: '2026-10-15' })
    const task2 = makeTask({ id: 't-2', due_date: '2026-12-01' })
    const { client, calls } = createMockClient({
      tasks: [task1, task2],
      projects: [{ id: 'proj-1', workspace_id: 'ws-1', client_id: 'c-1', name: 'P1' }],
      clients: [{ id: 'c-1', workspace_id: 'ws-1', display_name: 'C1' }],
      task_types: [{ id: 'type-1', workspace_id: 'ws-1', name: 'T1', is_active: true }],
      departments: [],
      task_type_departments: [],
      workflow_steps: [],
      workspace_members: [],
      profiles: [],
      sprints: [],
    })

    const results = await listCalendarTasks('ws-1', {
      dateMode: 'due_date',
      rangeStart: '2026-10-01',
      rangeEnd: '2026-10-31',
    }, client)

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('t-1')
    expect(calls).toContainEqual({ table: 'tasks', method: 'gte', args: ['due_date', '2026-10-01'] })
    expect(calls).toContainEqual({ table: 'tasks', method: 'lte', args: ['due_date', '2026-10-31'] })
  })

  it('getTaskByNumber: busca tarefa pelo número escopada pelo workspace tanto com número quanto com hash', async () => {
    const taskRecord = makeTask({ id: 't-1', task_number: 1847 })
    const { client, calls } = createMockClient({ tasks: [taskRecord] })

    const resNumber = await getTaskByNumber('ws-1', 1847, client)
    expect(resNumber.id).toBe('t-1')

    const resHash = await getTaskByNumber('ws-1', '#1847', client)
    expect(resHash.id).toBe('t-1')

    expect(calls).toContainEqual({ table: 'tasks', method: 'eq', args: ['workspace_id', 'ws-1'] })
    expect(calls).toContainEqual({ table: 'tasks', method: 'eq', args: ['task_number', 1847] })
  })

  it('dashboard counts: calcula active, overdue, dueToday e completed sem N+1', async () => {
    const activeNormal = makeTask({ id: 't-1', due_date: '2026-10-20', execution_date: '2026-10-14', completed_at: null, assignee_member_id: 'm-1' })
    const activeOverdue = makeTask({ id: 't-2', due_date: '2026-10-10', execution_date: '2026-10-08', completed_at: null, assignee_member_id: 'm-1' })
    const activeDueToday = makeTask({ id: 't-3', due_date: '2026-10-15', execution_date: '2026-10-15', completed_at: null, assignee_member_id: 'm-2' })
    const completedTask = makeTask({ id: 't-4', due_date: '2026-10-01', completed_at: '2026-10-10T10:00:00Z', assignee_member_id: 'm-1' })
    const archivedTask = makeTask({ id: 't-5', due_date: '2026-10-01', archived_at: '2026-10-05T10:00:00Z' })

    const { client } = createMockClient({
      tasks: [activeNormal, activeOverdue, activeDueToday, completedTask, archivedTask],
      workflow_steps: [
        { id: 'step-1', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Em andamento', position: 1, operational_nature: 'in_progress', is_internal_review: false, is_external_review: false, is_active: true },
      ],
      workspace_members: [
        { id: 'm-1', workspace_id: 'ws-1', user_id: 'u-1', role: 'member', status: 'active', job_title: null, created_at: '', updated_at: '' },
        { id: 'm-2', workspace_id: 'ws-1', user_id: 'u-2', role: 'member', status: 'active', job_title: null, created_at: '', updated_at: '' },
      ],
      profiles: [
        { id: 'u-1', full_name: 'Alice', avatar_url: null, phone: null, created_at: '', updated_at: '' },
        { id: 'u-2', full_name: 'Bob', avatar_url: null, phone: null, created_at: '', updated_at: '' },
      ],
    })

    const dashboard = await getTaskDashboardData('ws-1', { asOf: '2026-10-15' }, client)

    expect(dashboard.activeCount).toBe(3)
    expect(dashboard.overdueCount).toBe(1) // due_date: 2026-10-10 < 2026-10-15
    expect(dashboard.dueTodayCount).toBe(1) // due_date: 2026-10-15 == 2026-10-15
    expect(dashboard.completedCount).toBe(1)
    expect(dashboard.workloadByAssignee).toEqual(expect.arrayContaining([
      expect.objectContaining({ memberId: 'm-1', name: 'Alice', count: 2 }),
      expect.objectContaining({ memberId: 'm-2', name: 'Bob', count: 1 }),
    ]))
    expect(dashboard.distributionByOperationalNature.in_progress).toBeGreaterThanOrEqual(3)
  })

  it('waiting/review derivados do workflow quando aplicável: deriva review de is_internal_review/is_external_review e waiting de operational_nature sem hardcode', async () => {
    const taskReviewInternal = makeTask({ id: 't-rev-in', workflow_step_id: 'step-rev-in', completed_at: null })
    const taskReviewExternal = makeTask({ id: 't-rev-ex', workflow_step_id: 'step-rev-ex', completed_at: null })
    const taskWaitingBlocked = makeTask({ id: 't-wait', workflow_step_id: 'step-wait', completed_at: null })
    const taskNormalProgress = makeTask({ id: 't-norm', workflow_step_id: 'step-norm', completed_at: null })

    const { client } = createMockClient({
      tasks: [taskReviewInternal, taskReviewExternal, taskWaitingBlocked, taskNormalProgress],
      workflow_steps: [
        { id: 'step-rev-in', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Revisão Interna', position: 1, operational_nature: 'in_progress', is_internal_review: true, is_external_review: false, is_active: true },
        { id: 'step-rev-ex', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Aprovação do Cliente', position: 2, operational_nature: 'waiting', is_internal_review: false, is_external_review: true, is_active: true },
        { id: 'step-wait', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Aguardando Insumos', position: 3, operational_nature: 'waiting', is_internal_review: false, is_external_review: false, is_active: true },
        { id: 'step-norm', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Produção', position: 4, operational_nature: 'in_progress', is_internal_review: false, is_external_review: false, is_active: true },
      ],
      workspace_members: [],
      profiles: [],
    })

    const dashboard = await getTaskDashboardData('ws-1', { asOf: '2026-10-15' }, client)

    // reviewCount inclui internal e external review flags
    expect(dashboard.reviewCount).toBe(2)
    // waitingCount inclui etapas com operational_nature waiting que não sejam review
    expect(dashboard.waitingCount).toBe(1)
  })

  it('kanban data: organiza colunas preservando Task Type × Department → Workflow Step', async () => {
    const task1 = makeTask({ id: 't-1', task_type_id: 'type-1', workflow_step_id: 'step-1', sort_order: 1 })
    const task2 = makeTask({ id: 't-2', task_type_id: 'type-1', workflow_step_id: 'step-2', sort_order: 0 })
    const { client } = createMockClient({
      tasks: [task1, task2],
      projects: [{ id: 'proj-1', workspace_id: 'ws-1', client_id: 'c-1', name: 'Projeto A' }],
      clients: [{ id: 'c-1', workspace_id: 'ws-1', display_name: 'Cliente A' }],
      task_types: [{ id: 'type-1', workspace_id: 'ws-1', name: 'Reels Instagram', is_active: true }],
      departments: [
        { id: 'dept-roteiro', workspace_id: 'ws-1', name: 'Roteiro' },
        { id: 'dept-edicao', workspace_id: 'ws-1', name: 'Edição' },
      ],
      task_type_departments: [
        { id: 'ttd-1', workspace_id: 'ws-1', task_type_id: 'type-1', department_id: 'dept-roteiro', position: 1, is_active: true },
        { id: 'ttd-2', workspace_id: 'ws-1', task_type_id: 'type-1', department_id: 'dept-edicao', position: 2, is_active: true },
      ],
      workflow_steps: [
        { id: 'step-1', workspace_id: 'ws-1', task_type_department_id: 'ttd-1', name: 'Escrever', position: 1, operational_nature: 'in_progress', is_internal_review: false, is_external_review: false, is_active: true },
        { id: 'step-2', workspace_id: 'ws-1', task_type_department_id: 'ttd-2', name: 'Montagem', position: 1, operational_nature: 'in_progress', is_internal_review: false, is_external_review: false, is_active: true },
      ],
      workspace_members: [],
      profiles: [],
      sprints: [],
    })

    const kanban = await getKanbanData('ws-1', { taskTypeId: 'type-1' }, client)

    expect(kanban.columns).toHaveLength(2)
    expect(kanban.columns[0].department.name).toBe('Roteiro')
    expect(kanban.columns[0].step.name).toBe('Escrever')
    expect(kanban.columns[0].tasks).toHaveLength(1)
    expect(kanban.columns[0].tasks[0].id).toBe('t-1')

    expect(kanban.columns[1].department.name).toBe('Edição')
    expect(kanban.columns[1].step.name).toBe('Montagem')
    expect(kanban.columns[1].tasks).toHaveLength(1)
    expect(kanban.columns[1].tasks[0].id).toBe('t-2')

    // A estrutura hierárquica respeita Task Type -> Department -> Steps
    expect(kanban.boards[0].departments).toHaveLength(2)
    expect(kanban.boards[0].departments[0].department.name).toBe('Roteiro')
    expect(kanban.boards[0].departments[1].department.name).toBe('Edição')
  })
})

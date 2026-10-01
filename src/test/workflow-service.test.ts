import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { listDepartments } from '@/domains/workflows/services/department-service'
import { listTaskTypes } from '@/domains/workflows/services/task-type-service'
import { reorderTaskTypeDepartments } from '@/domains/workflows/services/task-type-department-service'
import { isDepartmentInTaskType } from '@/domains/workflows/services/task-type-department-service'
import { getWorkflowForTaskType } from '@/domains/workflows/queries/workflow-queries'
import type { Database } from '@/lib/supabase/database.types'

function fluentQuery(response: unknown, updates?: Array<Record<string, unknown>>) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const query: Record<string, unknown> = {}
  const chain = (method: string) => vi.fn((...args: unknown[]) => {
    calls.push({ method, args })
    return query
  })
  query.select = chain('select')
  query.eq = chain('eq')
  query.in = chain('in')
  query.order = chain('order')
  query.limit = chain('limit')
  query.update = vi.fn((payload: Record<string, unknown>) => {
    updates?.push(payload)
    calls.push({ method: 'update', args: [payload] })
    return query
  })
  query.maybeSingle = vi.fn(async () => response)
  query.single = vi.fn(async () => response)
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)
  return { query, calls }
}

describe('services tenant-scoped do workflow', () => {
  it('filtra tipos/departamentos pelo workspace e limita opções a ativos quando solicitado', async () => {
    const typeQuery = fluentQuery({ data: [], error: null })
    const departmentQuery = fluentQuery({ data: [], error: null })
    const client = {
      from: vi.fn((table: string) => table === 'task_types' ? typeQuery.query : departmentQuery.query),
    } as unknown as SupabaseClient<Database>

    await listTaskTypes('workspace-current', { activeOnly: true }, client)
    await listDepartments('workspace-current', { activeOnly: true }, client)

    for (const { calls } of [typeQuery, departmentQuery]) {
      expect(calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'workspace-current'] })
      expect(calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
    }
  })

  it('carrega hierarquia independente e filtra cada tabela pelo mesmo workspace', async () => {
    const taskTypeId = 'type-video'
    const association = {
      id: 'video-creative', workspace_id: 'workspace-current', task_type_id: taskTypeId,
      department_id: 'department-creative', position: 2, is_active: true, created_at: '', updated_at: '',
    }
    const typeQuery = fluentQuery({
      data: { id: taskTypeId, workspace_id: 'workspace-current', name: 'Vídeo', description: null, is_active: true, created_at: '', updated_at: '' },
      error: null,
    })
    const associationQuery = fluentQuery({ data: [association], error: null })
    const departmentQuery = fluentQuery({
      data: [{ id: 'department-creative', workspace_id: 'workspace-current', name: 'Criação', description: null, is_active: true, created_at: '', updated_at: '' }],
      error: null,
    })
    const stepsQuery = fluentQuery({
      data: [
        { id: 'step-edit', workspace_id: 'workspace-current', task_type_department_id: association.id, name: 'Editar', position: 2, operational_nature: 'in_progress', is_internal_review: false, is_external_review: false, is_revision: false, starts_timesheet: false, stops_timesheet: false, estimated_minutes: null, is_active: true, created_at: '', updated_at: '' },
        { id: 'step-script', workspace_id: 'workspace-current', task_type_department_id: association.id, name: 'Roteirizar', position: 1, operational_nature: 'todo', is_internal_review: false, is_external_review: false, is_revision: false, starts_timesheet: false, stops_timesheet: false, estimated_minutes: null, is_active: true, created_at: '', updated_at: '' },
      ],
      error: null,
    })
    const client = {
      from: vi.fn((table: string) => ({
        task_types: typeQuery.query,
        task_type_departments: associationQuery.query,
        departments: departmentQuery.query,
        workflow_steps: stepsQuery.query,
      })[table]),
    } as unknown as SupabaseClient<Database>

    const workflow = await getWorkflowForTaskType('workspace-current', taskTypeId, {}, client)

    expect(workflow.departments[0].association.position).toBe(2)
    expect(workflow.departments[0].steps.map(({ name }) => name)).toEqual(['Roteirizar', 'Editar'])
    for (const { calls } of [typeQuery, associationQuery, departmentQuery, stepsQuery]) {
      expect(calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'workspace-current'] })
    }
    expect(associationQuery.calls).toContainEqual({ method: 'eq', args: ['task_type_id', taskTypeId] })
    expect(departmentQuery.calls).toContainEqual({ method: 'in', args: ['id', ['department-creative']] })
    expect(stepsQuery.calls).toContainEqual({ method: 'in', args: ['task_type_department_id', ['video-creative']] })

    await getWorkflowForTaskType('workspace-current', taskTypeId, { activeOnly: true }, client)
    for (const { calls } of [associationQuery, departmentQuery, stepsQuery]) {
      expect(calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
    }
  })

  it('não carrega departamentos operacionais para um Tipo inativo', async () => {
    const taskTypeQuery = fluentQuery({
      data: { id: 'type-1', workspace_id: 'workspace-current', name: 'Vídeo', description: null, is_active: false, created_at: '', updated_at: '' },
      error: null,
    })
    const client = { from: vi.fn(() => taskTypeQuery.query) } as unknown as SupabaseClient<Database>

    const workflow = await getWorkflowForTaskType('workspace-current', 'type-1', { activeOnly: true }, client)
    expect(workflow.departments).toEqual([])
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it('verifica vínculo ativo Tipo×Departamento dentro do workspace atual', async () => {
    const taskTypeQuery = fluentQuery({ data: { id: 'type-1', is_active: true }, error: null })
    const associationQuery = fluentQuery({ data: { id: 'association-1' }, error: null })
    const departmentQuery = fluentQuery({ data: { id: 'department-1' }, error: null })
    const client = {
      from: vi.fn((table: string) => ({
        task_types: taskTypeQuery.query,
        task_type_departments: associationQuery.query,
        departments: departmentQuery.query,
      })[table]),
    } as unknown as SupabaseClient<Database>

    await expect(isDepartmentInTaskType(
      'workspace-current', 'type-1', 'department-1', { activeOnly: true }, client,
    )).resolves.toBe(true)
    for (const { calls } of [taskTypeQuery, associationQuery, departmentQuery]) {
      expect(calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'workspace-current'] })
    }
    expect(associationQuery.calls).toContainEqual({ method: 'eq', args: ['task_type_id', 'type-1'] })
    expect(associationQuery.calls).toContainEqual({ method: 'eq', args: ['department_id', 'department-1'] })
    expect(associationQuery.calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
    expect(departmentQuery.calls).toContainEqual({ method: 'eq', args: ['is_active', true] })
  })

  it('reordena associações com posições temporárias antes das posições finais', async () => {
    const workspaceId = 'workspace-current'
    const taskTypeId = 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3'
    const firstId = '8ce8dce5-e690-4f28-86b3-327ea393cd2f'
    const secondId = '8a6bd813-03e2-4f96-a461-7439436b290a'
    const originalRows = [
      { id: firstId, workspace_id: workspaceId, task_type_id: taskTypeId, department_id: 'd1', position: 1, is_active: true, created_at: '', updated_at: '' },
      { id: secondId, workspace_id: workspaceId, task_type_id: taskTypeId, department_id: 'd2', position: 2, is_active: true, created_at: '', updated_at: '' },
    ]
    const finalRows = [
      { ...originalRows[1], position: 1 },
      { ...originalRows[0], position: 2 },
    ]
    const updates: Array<Record<string, unknown>> = []
    let queryCount = 0
    const queries: ReturnType<typeof fluentQuery>[] = []
    const client = {
      from: vi.fn(() => {
        queryCount += 1
        const response = queryCount === 1
          ? { data: originalRows, error: null }
          : queryCount === 6
            ? { data: finalRows, error: null }
            : { error: null }
        const nextQuery = fluentQuery(response, updates)
        queries.push(nextQuery)
        return nextQuery.query
      }),
    } as unknown as SupabaseClient<Database>

    const result = await reorderTaskTypeDepartments(workspaceId, taskTypeId, {
      orderedIds: [secondId, firstId],
    }, client)

    expect(result.map(({ position }) => position)).toEqual([1, 2])
    expect(updates.map(({ position }) => position)).toEqual([3, 4, 1, 2])
    for (const query of queries.slice(1, 5)) {
      expect(query.calls).toContainEqual({ method: 'eq', args: ['workspace_id', workspaceId] })
      expect(query.calls).toContainEqual({ method: 'eq', args: ['task_type_id', taskTypeId] })
    }
  })
})
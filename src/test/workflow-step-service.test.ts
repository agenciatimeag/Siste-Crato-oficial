import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createWorkflowStep, reorderWorkflowSteps, updateWorkflowStep } from '@/domains/workflows/services/workflow-step-service'
import type { Database } from '@/lib/supabase/database.types'

function fluentQuery(response: unknown, updates?: Array<Record<string, unknown>>) {
  const query: Record<string, unknown> = {}
  const chain = vi.fn(() => query)
  query.select = chain
  query.eq = chain
  query.in = chain
  query.order = chain
  query.insert = chain
  query.update = vi.fn((values: Record<string, unknown>) => {
    updates?.push(values)
    return query
  })
  query.maybeSingle = vi.fn(async () => response)
  query.single = vi.fn(async () => response)
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)
  return query
}

describe('serviço de etapas de workflow', () => {
  it('cria etapa apenas depois de validar o vínculo no workspace', async () => {
    const associationQuery = fluentQuery({ data: { id: 'association-1' }, error: null })
    const stepQuery = {
      insert: vi.fn((values: Record<string, unknown>) => ({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...values, id: 'step-1', created_at: '', updated_at: '' },
          error: null,
        }),
      })),
    }
    const client = {
      from: vi.fn((table: string) => table === 'task_type_departments' ? associationQuery : stepQuery),
    } as unknown as SupabaseClient<Database>

    const result = await createWorkflowStep('workspace-1', 'association-1', {
      name: 'Aguardando cliente',
      position: 1,
      operational_nature: 'waiting',
    }, client)

    expect(associationQuery.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
    expect(result).toMatchObject({
      workspace_id: 'workspace-1',
      task_type_department_id: 'association-1',
      name: 'Aguardando cliente',
      operational_nature: 'waiting',
    })
  })

  it('rejeita tentativa de reassociar uma Etapa a outro Tipo×Departamento', async () => {
    const currentStep = {
      id: 'step-1', workspace_id: 'workspace-1', task_type_department_id: 'association-1',
      name: 'Editar', position: 1, operational_nature: 'in_progress', is_internal_review: false,
      is_external_review: false, is_revision: false, starts_timesheet: false, stops_timesheet: false,
      estimated_minutes: null, is_active: true, created_at: '', updated_at: '',
    }
    const stepQuery = fluentQuery({ data: currentStep, error: null })
    const client = { from: vi.fn(() => stepQuery) } as unknown as SupabaseClient<Database>

    await expect(updateWorkflowStep('workspace-1', 'step-1', {
      task_type_department_id: 'association-other',
      name: 'Wireframe',
    } as unknown as Partial<Parameters<typeof updateWorkflowStep>[2]>, client))
      .rejects.toMatchObject({ name: 'ZodError' })
    expect(stepQuery.update).not.toHaveBeenCalled()
    expect(stepQuery.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
  })

  it('rejeita posição fora da faixa antes de persistir outros campos', async () => {
    const currentStep = {
      id: 'step-1', workspace_id: 'workspace-1', task_type_department_id: 'association-1',
      name: 'Editar', position: 1, operational_nature: 'in_progress', is_internal_review: false,
      is_external_review: false, is_revision: false, starts_timesheet: false, stops_timesheet: false,
      estimated_minutes: null, is_active: true, created_at: '', updated_at: '',
    }
    const stepLookUp = fluentQuery({ data: currentStep, error: null })
    const associationLookUp = fluentQuery({ data: { id: 'association-1' }, error: null })
    const siblingSteps = fluentQuery({ data: [currentStep, { ...currentStep, id: 'step-2', position: 2 }], error: null })
    let workflowStepQueries = 0
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'task_type_departments') return associationLookUp
        workflowStepQueries += 1
        return workflowStepQueries === 1 ? stepLookUp : siblingSteps
      }),
    } as unknown as SupabaseClient<Database>

    await expect(updateWorkflowStep('workspace-1', 'step-1', {
      name: 'Novo nome',
      position: 3,
    }, client)).rejects.toMatchObject({ code: 'INVALID_REORDER' })
    expect(stepLookUp.update).not.toHaveBeenCalled()
  })

  it('reordena etapas em duas fases sem colidir na constraint de posição', async () => {
    const associationId = 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3'
    const firstId = '8ce8dce5-e690-4f28-86b3-327ea393cd2f'
    const secondId = '8a6bd813-03e2-4f96-a461-7439436b290a'
    const originalSteps = [
      { id: firstId, workspace_id: 'workspace-1', task_type_department_id: associationId, name: 'Planejar', position: 1 },
      { id: secondId, workspace_id: 'workspace-1', task_type_department_id: associationId, name: 'Briefing', position: 2 },
    ]
    const updates: Array<Record<string, unknown>> = []
    let associationQueryCount = 0
    let stepQueryCount = 0
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'task_type_departments') {
          associationQueryCount += 1
          return fluentQuery({ data: { id: associationId, is_active: true }, error: null })
        }
        stepQueryCount += 1
        if (stepQueryCount === 1) return fluentQuery({ data: originalSteps, error: null })
        if (stepQueryCount === 2) return fluentQuery({ error: null }, updates)
        if (stepQueryCount === 3) return fluentQuery({ error: null }, updates)
        if (stepQueryCount === 4) return fluentQuery({ error: null }, updates)
        if (stepQueryCount === 5) return fluentQuery({ error: null }, updates)
        return fluentQuery({ data: [
          { ...originalSteps[1], position: 1 },
          { ...originalSteps[0], position: 2 },
        ], error: null })
      }),
    } as unknown as SupabaseClient<Database>

    const reordered = await reorderWorkflowSteps('workspace-1', associationId, {
      orderedIds: [secondId, firstId],
    }, client)

    expect(reordered.map(({ position }) => position)).toEqual([1, 2])
    expect(updates.map(({ position }) => position)).toEqual([3, 4, 1, 2])
    expect(associationQueryCount).toBe(2)
  })
})
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { activateSprint, createSprint, deactivateSprint, getSprint, updateSprint } from '@/domains/tasks/services/sprint-service'
import type { Sprint } from '@/domains/tasks/types'
import type { Database } from '@/lib/supabase/database.types'

const sprintId = '16f67c23-1e8d-49d2-9d2f-20d123456789'

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: sprintId,
    workspace_id: 'workspace-1',
    name: 'Sprint Outubro',
    start_date: '2026-10-01',
    end_date: '2026-10-15',
    is_active: true,
    created_at: '',
    updated_at: '',
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
  for (const method of ['select', 'eq', 'order']) query[method] = chain(method)
  query.insert = vi.fn((values: unknown) => {
    inserts.push(values)
    return query
  })
  query.update = vi.fn((values: unknown) => {
    updates.push(values)
    return query
  })
  query.single = vi.fn(async () => response)
  query.maybeSingle = vi.fn(async () => response)
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(response).then(resolve, reject)
  return { query, calls }
}

function mockClient(queries: ReturnType<typeof fluentQuery>[]) {
  return {
    from: vi.fn(() => {
      const next = queries.shift()
      if (!next) throw new Error('Consulta Supabase inesperada')
      return next.query
    }),
  } as unknown as SupabaseClient<Database>
}

describe('serviço de Sprint', () => {
  it('cria Sprint no workspace e normaliza as datas', async () => {
    const inserts: unknown[] = []
    const created = makeSprint()
    const client = mockClient([fluentQuery({ data: created, error: null }, inserts)])

    await expect(createSprint('workspace-1', {
      name: ' Sprint Outubro ', start_date: '2026-10-01', end_date: '2026-10-15',
    }, client)).resolves.toEqual(created)
    expect(inserts).toEqual([{
      workspace_id: 'workspace-1', name: 'Sprint Outubro', start_date: '2026-10-01', end_date: '2026-10-15', is_active: true,
    }])
  })

  it('atualiza somente os campos solicitados e mantém as datas válidas', async () => {
    const current = makeSprint()
    const updated = makeSprint({ name: 'Sprint Revisada' })
    const updates: unknown[] = []
    const client = mockClient([
      fluentQuery({ data: current, error: null }),
      fluentQuery({ data: updated, error: null }, [], updates),
    ])

    await expect(updateSprint('workspace-1', sprintId, { name: 'Sprint Revisada' }, client)).resolves.toEqual(updated)
    expect(updates).toEqual([{ name: 'Sprint Revisada' }])
  })

  it('rejeita intervalos inválidos antes de gravar', async () => {
    const invalidCreateClient = mockClient([])
    await expect(createSprint('workspace-1', {
      name: 'Intervalo inválido', start_date: '2026-10-15', end_date: '2026-10-01',
    }, invalidCreateClient)).rejects.toMatchObject({ name: 'ZodError' })

    const current = makeSprint()
    const currentQuery = fluentQuery({ data: current, error: null })
    const invalidUpdateClient = mockClient([currentQuery])
    await expect(updateSprint('workspace-1', sprintId, { end_date: '2026-09-30' }, invalidUpdateClient))
      .rejects.toMatchObject({ name: 'ZodError' })
  })

  it('escopa a leitura pelo workspace', async () => {
    const query = fluentQuery({ data: null, error: null })
    const client = mockClient([query])
    await expect(getSprint('workspace-1', sprintId, client)).rejects.toMatchObject({ code: 'SPRINT_NOT_FOUND' })
    expect(query.calls).toContainEqual({ method: 'eq', args: ['workspace_id', 'workspace-1'] })
    expect(query.calls).toContainEqual({ method: 'eq', args: ['id', sprintId] })
  })

  it('ativa e desativa Sprint sem alterar seu intervalo', async () => {
    const current = makeSprint()
    const inactive = makeSprint({ is_active: false })
    const active = makeSprint({ is_active: true })
    const deactivationUpdates: unknown[] = []
    const activationUpdates: unknown[] = []
    const client = mockClient([
      fluentQuery({ data: current, error: null }),
      fluentQuery({ data: inactive, error: null }, [], deactivationUpdates),
      fluentQuery({ data: inactive, error: null }),
      fluentQuery({ data: active, error: null }, [], activationUpdates),
    ])

    await expect(deactivateSprint('workspace-1', sprintId, client)).resolves.toEqual(inactive)
    await expect(activateSprint('workspace-1', sprintId, client)).resolves.toEqual(active)
    expect(deactivationUpdates).toEqual([{ is_active: false }])
    expect(activationUpdates).toEqual([{ is_active: true }])
  })
})
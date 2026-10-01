import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { listClients } from '@/domains/clients/services/client-service'
import { recordActivity } from '@/domains/activity/activity-service'
import { createProject } from '@/domains/projects/services/project-service'
import type { Database } from '@/lib/supabase/database.types'

function makeThenableQuery(result: unknown) {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'ilike', 'order']) {
    query[method] = vi.fn(() => query)
  }
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)
  query.maybeSingle = vi.fn().mockResolvedValue(result)
  return query
}

describe('serviços tenant-scoped', () => {
  it('sempre restringe a listagem de clientes ao workspace e filtros solicitados', async () => {
    const query = makeThenableQuery({ data: [], error: null }) as Record<string, ReturnType<typeof vi.fn>>
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient<Database>

    await expect(listClients('workspace-current', { status: 'active', search: 'Agência' }, client)).resolves.toEqual([])
    expect(client.from).toHaveBeenCalledWith('clients')
    expect(query.eq).toHaveBeenCalledWith('workspace_id', 'workspace-current')
    expect(query.eq).toHaveBeenCalledWith('status', 'active')
    expect(query.ilike).toHaveBeenCalledWith('display_name', '%Agência%')
  })

  it('rejeita projeto cujo cliente não pertence ao workspace antes de inserir', async () => {
    const clientQuery = makeThenableQuery({ data: null, error: null })
    const client = {
      from: vi.fn((table: string) => table === 'clients' ? clientQuery : makeThenableQuery({ data: null, error: null })),
    } as unknown as SupabaseClient<Database>

    await expect(createProject('workspace-current', {
      client_id: 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3',
      name: 'Projeto isolado',
    }, null, client)).rejects.toMatchObject({ code: 'CLIENT_NOT_FOUND' })
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith('clients')
  })

  it('grava atividade no workspace e associa o membro ator atual', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = { from: vi.fn(() => ({ insert })) } as unknown as SupabaseClient<Database>
    await recordActivity({
      workspaceId: 'workspace-current',
      entityType: 'client',
      entityId: 'client-current',
      action: 'client.created',
      actorMemberId: 'member-current',
      metadata: { display_name: 'Agência Time' },
    }, client)

    expect(client.from).toHaveBeenCalledWith('activity_log')
    expect(insert).toHaveBeenCalledWith({
      workspace_id: 'workspace-current',
      entity_type: 'client',
      entity_id: 'client-current',
      action: 'client.created',
      actor_member_id: 'member-current',
      metadata: { display_name: 'Agência Time' },
    })
  })
})
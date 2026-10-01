import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  createClientContact,
  removeClientContact,
  setPrimaryContact,
  updateClientContact,
} from '@/domains/clients/services/contact-service'
import type { Database } from '@/lib/supabase/database.types'

function createQueryBuilder(responses: {
  maybeSingle?: unknown[]
  single?: unknown[]
  then?: unknown[]
}) {
  const maybeSingleResponses = [...(responses.maybeSingle ?? [])]
  const singleResponses = [...(responses.single ?? [])]
  const thenResponses = [...(responses.then ?? [])]
  const query: Record<string, unknown> = {}
  const chain = vi.fn(() => query)
  query.select = chain
  query.eq = chain
  query.neq = chain
  query.insert = chain
  query.update = chain
  query.delete = chain
  query.order = chain
  query.maybeSingle = vi.fn(() => Promise.resolve(maybeSingleResponses.shift()))
  query.single = vi.fn(() => Promise.resolve(singleResponses.shift()))
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
    Promise.resolve(thenResponses.shift()).then(resolve, reject)
  return query
}

describe('consistência do contato principal', () => {
  it('não remove o principal atual se o contato solicitado não pertence ao cliente', async () => {
    const clientQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'client-1' }, error: null }),
    }
    const contactQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn(),
    }
    const client = {
      from: vi.fn((table: string) => table === 'clients' ? clientQuery : contactQuery),
    } as unknown as SupabaseClient<Database>

    await expect(setPrimaryContact('workspace-1', 'client-1', 'contact-other', null, client))
      .rejects.toMatchObject({ code: 'CONTACT_NOT_FOUND' })
    expect(clientQuery.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
    expect(contactQuery.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
    expect(contactQuery.update).not.toHaveBeenCalled()
  })

  it('registra contact.created no histórico do cliente, sem entity_type inválido', async () => {
    const clientLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'client-1' }, error: null }),
    }
    const contactInsert = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'contact-1',
          workspace_id: 'workspace-1',
          client_id: 'client-1',
          name: 'Ana Silva',
          role_title: null,
          email: 'ana@empresa.com',
          phone: null,
          is_primary: false,
          notes: null,
          created_at: '',
          updated_at: '',
        },
        error: null,
      }),
    }
    const insertedEvents: Array<Record<string, unknown>> = []
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'clients') return clientLookup
        if (table === 'client_contacts') {
          return { insert: vi.fn(() => contactInsert) }
        }
        return { insert: vi.fn(async (event: Record<string, unknown>) => {
          insertedEvents.push(event)
          return { error: null }
        }) }
      }),
    } as unknown as SupabaseClient<Database>

    await createClientContact('workspace-1', 'client-1', {
      name: 'Ana Silva',
      role_title: null,
      phone: null,
      email: 'ana@empresa.com',
      is_primary: false,
      notes: null,
    }, 'member-1', client)

    expect(insertedEvents).toEqual([{
      workspace_id: 'workspace-1',
      entity_type: 'client',
      entity_id: 'client-1',
      action: 'contact.created',
      actor_member_id: 'member-1',
      metadata: { contact_id: 'contact-1', name: 'Ana Silva', is_primary: false },
    }])
    expect(insertedEvents[0].entity_type).not.toBe('contact')
  })

  it('registra contact.updated uma vez no histórico do cliente', async () => {
    const current = {
      id: 'contact-1', workspace_id: 'workspace-1', client_id: 'client-1', name: 'Ana Silva',
      role_title: null, email: 'old@empresa.com', phone: null, is_primary: false, notes: null,
      created_at: '', updated_at: '',
    }
    const updated = { ...current, email: 'new@empresa.com' }
    const clientQuery = createQueryBuilder({ maybeSingle: [{ data: { id: 'client-1' }, error: null }] })
    const contactQuery = createQueryBuilder({ maybeSingle: [{ data: current, error: null }], single: [{ data: updated, error: null }], then: [{ error: null }] })
    const events: Array<Record<string, unknown>> = []
    const activityQuery = {
      insert: vi.fn(async (event: Record<string, unknown>) => {
        events.push(event)
        return { error: null }
      }),
    }
    const client = {
      from: vi.fn((table: string) => table === 'clients' ? clientQuery : table === 'client_contacts' ? contactQuery : activityQuery),
    } as unknown as SupabaseClient<Database>

    await updateClientContact('workspace-1', 'client-1', 'contact-1', { email: 'new@empresa.com' }, 'member-1', client)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      entity_type: 'client', entity_id: 'client-1', action: 'contact.updated', actor_member_id: 'member-1',
      metadata: { contact_id: 'contact-1', changed_fields: ['email'] },
    })
  })

  it('registra contact.primary_changed uma vez com o contato anterior em metadata', async () => {
    const clientQuery = createQueryBuilder({ maybeSingle: [{ data: { id: 'client-1' }, error: null }] })
    const contactQuery = createQueryBuilder({
      maybeSingle: [
        { data: { id: 'contact-new', name: 'Ana Silva', is_primary: false }, error: null },
        { data: { id: 'contact-old' }, error: null },
      ],
      single: [{ data: { id: 'contact-new', name: 'Ana Silva', is_primary: true }, error: null }],
      then: [{ error: null }],
    })
    const events: Array<Record<string, unknown>> = []
    const activityQuery = {
      insert: vi.fn(async (event: Record<string, unknown>) => {
        events.push(event)
        return { error: null }
      }),
    }
    const client = {
      from: vi.fn((table: string) => table === 'clients' ? clientQuery : table === 'client_contacts' ? contactQuery : activityQuery),
    } as unknown as SupabaseClient<Database>

    await setPrimaryContact('workspace-1', 'client-1', 'contact-new', 'member-1', client)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      entity_type: 'client', entity_id: 'client-1', action: 'contact.primary_changed', actor_member_id: 'member-1',
      metadata: { contact_id: 'contact-new', previous_primary_contact_id: 'contact-old' },
    })
  })

  it('registra contact.deleted uma vez no histórico do cliente', async () => {
    const contact = { id: 'contact-1', name: 'Ana Silva', is_primary: false }
    const contactQuery = createQueryBuilder({ maybeSingle: [
      { data: contact, error: null },
      { data: { id: 'contact-1' }, error: null },
    ] })
    const events: Array<Record<string, unknown>> = []
    const activityQuery = {
      insert: vi.fn(async (event: Record<string, unknown>) => {
        events.push(event)
        return { error: null }
      }),
    }
    const client = {
      from: vi.fn((table: string) => table === 'client_contacts' ? contactQuery : activityQuery),
    } as unknown as SupabaseClient<Database>

    await removeClientContact('workspace-1', 'client-1', 'contact-1', 'member-1', client)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      entity_type: 'client', entity_id: 'client-1', action: 'contact.deleted', actor_member_id: 'member-1',
      metadata: { contact_id: 'contact-1', name: 'Ana Silva', was_primary: false },
    })
  })
})
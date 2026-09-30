import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceForUser, getWorkspaceForUser } from '@/domains/workspaces/workspace-service'
import type { Database } from '@/lib/supabase/database.types'

describe('workspace bootstrap', () => {
  it('gera o UUID no cliente e cria workspace antes do vínculo owner/active', async () => {
    const inserts: Array<{ table: string; values: unknown }> = []
    const client = {
      from: vi.fn((table: string) => ({
        insert: vi.fn(async (values: unknown) => {
          inserts.push({ table, values })
          return { error: null }
        }),
      })),
    } as unknown as SupabaseClient<Database>
    const createId = vi.fn(() => 'workspace-uuid')

    const workspace = await createWorkspaceForUser(
      'user-current',
      '  Agência Time  ',
      client,
      createId,
    )

    expect(createId).toHaveBeenCalledOnce()
    expect(inserts).toEqual([
      { table: 'workspaces', values: { id: 'workspace-uuid', name: 'Agência Time' } },
      {
        table: 'workspace_members',
        values: {
          workspace_id: 'workspace-uuid',
          user_id: 'user-current',
          role: 'owner',
          status: 'active',
        },
      },
    ])
    expect(workspace).toEqual({ id: 'workspace-uuid', name: 'Agência Time' })
  })

  it('usa o workspace do primeiro vínculo retornado para o usuário', async () => {
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { workspace_id: 'workspace-1', created_at: '2026-01-01' },
        error: null,
      }),
    }
    const workspaceQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'workspace-1', name: 'Agência Time' },
        error: null,
      }),
    }
    const client = {
      from: vi.fn((table: string) => table === 'workspace_members' ? membershipQuery : workspaceQuery),
    } as unknown as SupabaseClient<Database>

    await expect(getWorkspaceForUser('user-current', client)).resolves.toEqual({
      id: 'workspace-1',
      name: 'Agência Time',
    })
    expect(membershipQuery.eq).toHaveBeenCalledWith('user_id', 'user-current')
    expect(workspaceQuery.eq).toHaveBeenCalledWith('id', 'workspace-1')
  })
})
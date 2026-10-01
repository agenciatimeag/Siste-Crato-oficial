import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  createWorkspaceForUser,
  getLastSelectedWorkspaceId,
  listWorkspacesForUser,
  rememberWorkspaceSelection,
  resolveWorkspaceSelection,
} from '@/domains/workspaces/workspace-service'
import type { Workspace } from '@/domains/workspaces/workspace-service'
import type { Database } from '@/lib/supabase/database.types'

describe('workspace bootstrap', () => {
  it('gera o UUID no cliente e cria workspace antes do vínculo owner/active', async () => {
    const inserts: Array<{ table: string; values: unknown }> = []
    const client = {
      from: vi.fn((table: string) => ({
        insert: vi.fn((values: unknown) => {
          inserts.push({ table, values })
          if (table === 'workspace_members') {
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: { id: 'member-uuid' }, error: null }),
            }
          }
          return Promise.resolve({ error: null })
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
    expect(workspace).toEqual({ id: 'workspace-uuid', name: 'Agência Time', memberId: 'member-uuid' })
  })

  it('lista todos os workspaces com vínculos ativos do usuário', async () => {
    const membershipQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: [
          { id: 'member-1', workspace_id: 'workspace-1' },
          { id: 'member-2', workspace_id: 'workspace-2' },
        ],
        error: null,
      }).then(resolve),
    }
    const workspaceQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({
        data: [
          { id: 'workspace-1', name: 'Agência Time' },
          { id: 'workspace-2', name: 'Agência Sul' },
        ],
        error: null,
      }).then(resolve),
    }
    const client = {
      from: vi.fn((table: string) => table === 'workspace_members' ? membershipQuery : workspaceQuery),
    } as unknown as SupabaseClient<Database>

    await expect(listWorkspacesForUser('user-current', client)).resolves.toEqual([
      { id: 'workspace-1', name: 'Agência Time', memberId: 'member-1' },
      { id: 'workspace-2', name: 'Agência Sul', memberId: 'member-2' },
    ])
    expect(membershipQuery.eq).toHaveBeenCalledWith('user_id', 'user-current')
    expect(membershipQuery.eq).toHaveBeenCalledWith('status', 'active')
    expect(workspaceQuery.in).toHaveBeenCalledWith('id', ['workspace-1', 'workspace-2'])
  })
})

const workspaces: Workspace[] = [
  { id: 'workspace-1', name: 'Agência Time', memberId: 'member-1' },
  { id: 'workspace-2', name: 'Agência Sul', memberId: 'member-2' },
]

describe('resolução da seleção de workspace', () => {
  it('manda para onboarding quando não há workspaces ativos', () => {
    expect(resolveWorkspaceSelection([], null)).toEqual({ status: 'missing', workspace: null })
  })

  it('entra automaticamente quando existe exatamente um workspace ativo', () => {
    expect(resolveWorkspaceSelection([workspaces[0]], null)).toEqual({
      status: 'ready',
      workspace: workspaces[0],
    })
  })

  it('usa a última escolha quando ela ainda pertence aos workspaces ativos', () => {
    expect(resolveWorkspaceSelection(workspaces, 'workspace-2')).toEqual({
      status: 'ready',
      workspace: workspaces[1],
    })
  })

  it('exige seleção se há vários workspaces sem escolha anterior válida', () => {
    expect(resolveWorkspaceSelection(workspaces, null)).toEqual({
      status: 'selection_required',
      workspace: null,
    })
    expect(resolveWorkspaceSelection(workspaces, 'workspace-revoked')).toEqual({
      status: 'selection_required',
      workspace: null,
    })
  })

  it('persiste a escolha separadamente por usuário', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }
    rememberWorkspaceSelection('user-1', 'workspace-1', storage)
    rememberWorkspaceSelection('user-2', 'workspace-2', storage)
    expect(getLastSelectedWorkspaceId('user-1', storage)).toBe('workspace-1')
    expect(getLastSelectedWorkspaceId('user-2', storage)).toBe('workspace-2')
  })
})
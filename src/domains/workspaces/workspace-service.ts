import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

export type Workspace = {
  id: string
  name: string
  memberId: string
}

export type WorkspaceResolution =
  | { status: 'missing'; workspace: null }
  | { status: 'ready'; workspace: Workspace }
  | { status: 'selection_required'; workspace: null }

export type WorkspaceSelectionStorage = Pick<Storage, 'getItem' | 'setItem'>

const workspaceStorageKey = (userId: string) => `crato:last-workspace:${userId}`

function getBrowserStorage(storage?: WorkspaceSelectionStorage) {
  if (storage) return storage
  return typeof window === 'undefined' ? null : window.localStorage
}

export function getLastSelectedWorkspaceId(userId: string, storage?: WorkspaceSelectionStorage) {
  return getBrowserStorage(storage)?.getItem(workspaceStorageKey(userId)) ?? null
}

export function rememberWorkspaceSelection(
  userId: string,
  workspaceId: string,
  storage?: WorkspaceSelectionStorage,
) {
  getBrowserStorage(storage)?.setItem(workspaceStorageKey(userId), workspaceId)
}

export function resolveWorkspaceSelection(
  workspaces: Workspace[],
  lastSelectedWorkspaceId: string | null,
): WorkspaceResolution {
  if (workspaces.length === 0) return { status: 'missing', workspace: null }
  if (workspaces.length === 1) return { status: 'ready', workspace: workspaces[0] }

  const selectedWorkspace = workspaces.find(({ id }) => id === lastSelectedWorkspaceId)
  if (selectedWorkspace) return { status: 'ready', workspace: selectedWorkspace }
  return { status: 'selection_required', workspace: null }
}

export async function listWorkspacesForUser(
  userId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Workspace[]> {
  const { data: memberships, error: membershipError } = await client
    .from('workspace_members')
    .select('id, workspace_id')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (membershipError) throw membershipError
  if (!memberships?.length) return []

  const { data: workspaces, error: workspaceError } = await client
    .from('workspaces')
    .select('id, name')
    .in('id', memberships.map(({ workspace_id }) => workspace_id))

  if (workspaceError) throw workspaceError
  const membershipsByWorkspace = new Map(memberships.map(({ id, workspace_id }) => [workspace_id, id]))
  return (workspaces ?? []).map((workspace) => ({
    ...workspace,
    memberId: membershipsByWorkspace.get(workspace.id)!,
  }))
}

export async function createWorkspaceForUser(
  userId: string,
  name: string,
  client: SupabaseClient<Database> = supabase,
  createId: () => string = () => crypto.randomUUID(),
): Promise<Workspace> {
  const normalizedName = name.trim()
  if (!normalizedName) throw new Error('Informe o nome do espaço de trabalho.')

  const workspace = { id: createId(), name: normalizedName }
  const { error: workspaceError } = await client.from('workspaces').insert(workspace)
  if (workspaceError) throw workspaceError

  const { data: membership, error: membershipError } = await client
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
      status: 'active',
    })
    .select('id')
    .single()
  if (membershipError) throw membershipError

  return { ...workspace, memberId: membership.id }
}
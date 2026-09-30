import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

export type Workspace = {
  id: string
  name: string
}

export async function getWorkspaceForUser(
  userId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Workspace | null> {
  const { data: membership, error: membershipError } = await client
    .from('workspace_members')
    .select('workspace_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membershipError) throw membershipError
  if (!membership) return null

  const { data: workspace, error: workspaceError } = await client
    .from('workspaces')
    .select('id, name')
    .eq('id', membership.workspace_id)
    .single()

  if (workspaceError) throw workspaceError
  return workspace
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

  const { error: membershipError } = await client.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: userId,
    role: 'owner',
    status: 'active',
  })
  if (membershipError) throw membershipError

  return workspace
}
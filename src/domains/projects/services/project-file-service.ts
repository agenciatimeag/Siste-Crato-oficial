import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import type { ProjectFile } from '@/domains/projects/types'

export async function listProjectFiles(
  workspaceId: string,
  projectId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<ProjectFile[]> {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
  const { data, error } = await client.from('project_files').select('*')
    .eq('workspace_id', workspaceId).eq('project_id', projectId).order('created_at', { ascending: false })
  if (error) throw mapDatabaseError(error)
  return data ?? []
}
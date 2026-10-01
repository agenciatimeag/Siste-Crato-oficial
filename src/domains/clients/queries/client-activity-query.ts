import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'

export async function listClientActivity(
  workspaceId: string,
  clientId: string,
  client: SupabaseClient<Database> = supabase,
) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
  const [contracts, projects] = await Promise.all([
    client.from('contracts').select('id').eq('workspace_id', workspaceId).eq('client_id', clientId),
    client.from('projects').select('id').eq('workspace_id', workspaceId).eq('client_id', clientId),
  ])
  if (contracts.error) throw mapDatabaseError(contracts.error)
  if (projects.error) throw mapDatabaseError(projects.error)

  const requests = [
    client.from('activity_log').select('*').eq('workspace_id', workspaceId)
      .eq('entity_type', 'client').eq('entity_id', clientId),
  ]
  if (contracts.data?.length) {
    requests.push(client.from('activity_log').select('*').eq('workspace_id', workspaceId)
      .eq('entity_type', 'contract').in('entity_id', contracts.data.map((contract) => contract.id)))
  }
  if (projects.data?.length) {
    requests.push(client.from('activity_log').select('*').eq('workspace_id', workspaceId)
      .eq('entity_type', 'project').in('entity_id', projects.data.map((project) => project.id)))
  }

  const results = await Promise.all(requests)
  for (const result of results) if (result.error) throw mapDatabaseError(result.error)
  return results.flatMap((result) => result.data ?? [])
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
}
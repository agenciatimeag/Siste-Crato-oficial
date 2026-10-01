import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import type { ActivityEntityType } from '@/domains/activity/activity-service'

export async function listActivity(
  workspaceId: string,
  entityType: ActivityEntityType,
  entityId: string,
  client: SupabaseClient<Database> = supabase,
) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
  const { data, error } = await client.from('activity_log').select('*')
    .eq('workspace_id', workspaceId).eq('entity_type', entityType).eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) throw mapDatabaseError(error)
  return data ?? []
}
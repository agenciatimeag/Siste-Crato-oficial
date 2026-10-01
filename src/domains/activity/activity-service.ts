import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { mapDatabaseError } from '@/domains/shared/domain-error'

export type ActivityEntityType = Database['public']['Tables']['activity_log']['Row']['entity_type']

export type RecordActivityInput = {
  workspaceId: string
  entityType: ActivityEntityType
  entityId: string
  action: string
  metadata?: Record<string, unknown>
  actorMemberId?: string | null
}

export async function recordActivity(
  input: RecordActivityInput,
  client: SupabaseClient<Database> = supabase,
) {
  if (!input.workspaceId.trim()) {
    throw new Error('O workspace precisa estar resolvido antes de registrar atividade.')
  }
  const { error } = await client.from('activity_log').insert({
    workspace_id: input.workspaceId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    actor_member_id: input.actorMemberId ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) throw mapDatabaseError(error)
}
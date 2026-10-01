import type { SupabaseClient } from '@supabase/supabase-js'
import { recordActivity } from '@/domains/activity/activity-service'
import { DomainError } from '@/domains/shared/domain-error'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { getTask } from '@/domains/tasks/queries/task-query-service'
import type { Database } from '@/lib/supabase/database.types'

export function requireTaskWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export async function requireTaskMember(
  workspaceId: string,
  memberId: string,
  client: SupabaseClient<Database>,
) {
  const { data, error } = await client.from('workspace_members').select('id')
    .eq('workspace_id', workspaceId).eq('id', memberId).eq('status', 'active').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('O membro selecionado não está ativo neste workspace.', 'WORKSPACE_MEMBER_NOT_ACTIVE')
}

export async function requireTaskInWorkspace(
  workspaceId: string,
  taskId: string,
  client: SupabaseClient<Database>,
) {
  requireTaskWorkspace(workspaceId)
  return getTask(workspaceId, taskId, client)
}

export async function recordTaskActivity(
  workspaceId: string,
  taskId: string,
  action: string,
  actorMemberId: string | null | undefined,
  metadata: Record<string, unknown>,
  client: SupabaseClient<Database>,
) {
  try {
    await recordActivity({
      workspaceId,
      entityType: 'task',
      entityId: taskId,
      action,
      actorMemberId,
      metadata,
    }, client)
  } catch (error) {
    throw mapTaskError(error)
  }
}
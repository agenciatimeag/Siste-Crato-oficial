import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { DomainError } from '@/domains/shared/domain-error'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { taskSavedViewCreateSchema, taskSavedViewUpdateSchema } from '@/domains/tasks/schemas/task-saved-view-schema'
import { requireTaskMember, requireTaskWorkspace } from '@/domains/tasks/services/task-collaboration-service'
import type { TaskSavedView, TaskSavedViewSettings, TaskSavedViewType } from '@/domains/tasks/types'
import { supabase } from '@/lib/supabase/client'

async function getSavedView(
  workspaceId: string,
  memberId: string,
  viewId: string,
  client: SupabaseClient<Database>,
): Promise<TaskSavedView> {
  const { data, error } = await client.from('task_saved_views').select('*')
    .eq('workspace_id', workspaceId).eq('member_id', memberId).eq('id', viewId).maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Visualização salva não encontrada neste workspace.', 'TASK_SAVED_VIEW_NOT_FOUND')
  return data
}

export async function listSavedViews(
  workspaceId: string,
  memberId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSavedView[]> {
  requireTaskWorkspace(workspaceId)
  await requireTaskMember(workspaceId, memberId, client)
  const { data, error } = await client.from('task_saved_views').select('*')
    .eq('workspace_id', workspaceId).eq('member_id', memberId).order('view_type').order('name')
  if (error) throw mapTaskError(error)
  return data ?? []
}

export async function setDefaultSavedView(
  workspaceId: string,
  memberId: string,
  viewId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSavedView> {
  const target = await getSavedView(workspaceId, memberId, viewId, client)
  if (target.is_default) return target
  const { data: currentDefault, error: defaultError } = await client.from('task_saved_views').select('id')
    .eq('workspace_id', workspaceId).eq('member_id', memberId).eq('view_type', target.view_type).eq('is_default', true).maybeSingle()
  if (defaultError) throw mapTaskError(defaultError)
  if (currentDefault) {
    const { error } = await client.from('task_saved_views').update({ is_default: false })
      .eq('workspace_id', workspaceId).eq('id', currentDefault.id)
    if (error) throw mapTaskError(error)
  }
  const { data, error } = await client.from('task_saved_views').update({ is_default: true })
    .eq('workspace_id', workspaceId).eq('member_id', memberId).eq('id', viewId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Visualização salva não encontrada neste workspace.', 'TASK_SAVED_VIEW_NOT_FOUND')
  return data
}

export async function createSavedView(
  workspaceId: string,
  memberId: string,
  input: { name: string; view_type: TaskSavedViewType; settings?: TaskSavedViewSettings; is_default?: boolean },
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSavedView> {
  requireTaskWorkspace(workspaceId)
  await requireTaskMember(workspaceId, memberId, client)
  const values = taskSavedViewCreateSchema.parse(input)
  const { data, error } = await client.from('task_saved_views').insert({
    workspace_id: workspaceId,
    member_id: memberId,
    name: values.name,
    view_type: values.view_type,
    settings: values.settings,
    is_default: false,
  }).select('*').single()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Não foi possível criar a visualização salva.', 'TASK_SAVED_VIEW_CREATE_FAILED')
  return values.is_default ? setDefaultSavedView(workspaceId, memberId, data.id, client) : data
}

export async function updateSavedView(
  workspaceId: string,
  memberId: string,
  viewId: string,
  input: { name?: string; settings?: TaskSavedViewSettings },
  client: SupabaseClient<Database> = supabase,
): Promise<TaskSavedView> {
  await getSavedView(workspaceId, memberId, viewId, client)
  const values = taskSavedViewUpdateSchema.parse(input)
  if (Object.keys(values).length === 0) return getSavedView(workspaceId, memberId, viewId, client)
  const { data, error } = await client.from('task_saved_views').update(values)
    .eq('workspace_id', workspaceId).eq('member_id', memberId).eq('id', viewId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Visualização salva não encontrada neste workspace.', 'TASK_SAVED_VIEW_NOT_FOUND')
  return data
}

export async function deleteSavedView(
  workspaceId: string,
  memberId: string,
  viewId: string,
  client: SupabaseClient<Database> = supabase,
) {
  await getSavedView(workspaceId, memberId, viewId, client)
  const { error } = await client.from('task_saved_views').delete()
    .eq('workspace_id', workspaceId).eq('member_id', memberId).eq('id', viewId)
  if (error) throw mapTaskError(error)
}
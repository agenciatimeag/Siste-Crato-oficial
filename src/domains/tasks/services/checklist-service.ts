import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { DomainError } from '@/domains/shared/domain-error'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { checklistItemCreateSchema, checklistItemUpdateSchema, checklistReorderSchema } from '@/domains/tasks/schemas/checklist-schema'
import { recordTaskActivity, requireTaskInWorkspace, requireTaskMember } from '@/domains/tasks/services/task-collaboration-service'
import type { TaskChecklistItem } from '@/domains/tasks/types'
import { supabase } from '@/lib/supabase/client'

async function getChecklistItem(
  workspaceId: string,
  itemId: string,
  client: SupabaseClient<Database>,
): Promise<TaskChecklistItem> {
  const { data, error } = await client.from('task_checklist_items').select('*')
    .eq('workspace_id', workspaceId).eq('id', itemId).maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Item de checklist não encontrado neste workspace.', 'CHECKLIST_ITEM_NOT_FOUND')
  return data
}

export async function listChecklistItems(
  workspaceId: string,
  taskId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskChecklistItem[]> {
  await requireTaskInWorkspace(workspaceId, taskId, client)
  const { data, error } = await client.from('task_checklist_items').select('*')
    .eq('workspace_id', workspaceId).eq('task_id', taskId).order('position')
  if (error) throw mapTaskError(error)
  return data ?? []
}

export async function createChecklistItem(
  workspaceId: string,
  taskId: string,
  input: { title: string; position?: number },
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskChecklistItem> {
  await requireTaskInWorkspace(workspaceId, taskId, client)
  const values = checklistItemCreateSchema.parse(input)
  if (actorMemberId) await requireTaskMember(workspaceId, actorMemberId, client)
  let position = values.position
  if (!position) {
    const { data, error } = await client.from('task_checklist_items').select('position')
      .eq('workspace_id', workspaceId).eq('task_id', taskId).order('position', { ascending: false }).limit(1).maybeSingle()
    if (error) throw mapTaskError(error)
    position = (data?.position ?? 0) + 1
  }
  const { data, error } = await client.from('task_checklist_items').insert({
    workspace_id: workspaceId,
    task_id: taskId,
    title: values.title,
    position,
    created_by_member_id: actorMemberId ?? null,
  }).select('*').single()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Não foi possível criar o item de checklist.', 'CHECKLIST_ITEM_CREATE_FAILED')
  await recordTaskActivity(workspaceId, taskId, 'task.checklist_created', actorMemberId, { checklist_item_id: data.id }, client)
  return data
}

export async function updateChecklistItem(
  workspaceId: string,
  itemId: string,
  input: { title: string },
  client: SupabaseClient<Database> = supabase,
): Promise<TaskChecklistItem> {
  const values = checklistItemUpdateSchema.parse(input)
  const { data, error } = await client.from('task_checklist_items').update({ title: values.title })
    .eq('workspace_id', workspaceId).eq('id', itemId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Item de checklist não encontrado neste workspace.', 'CHECKLIST_ITEM_NOT_FOUND')
  return data
}

export async function toggleChecklistItem(
  workspaceId: string,
  itemId: string,
  isCompleted: boolean,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskChecklistItem> {
  const current = await getChecklistItem(workspaceId, itemId, client)
  if (current.is_completed === isCompleted) return current
  if (isCompleted && actorMemberId) await requireTaskMember(workspaceId, actorMemberId, client)
  const payload = isCompleted
    ? { is_completed: true, completed_at: new Date().toISOString(), completed_by_member_id: actorMemberId ?? null }
    : { is_completed: false, completed_at: null, completed_by_member_id: null }
  const { data, error } = await client.from('task_checklist_items').update(payload)
    .eq('workspace_id', workspaceId).eq('id', itemId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Item de checklist não encontrado neste workspace.', 'CHECKLIST_ITEM_NOT_FOUND')
  await recordTaskActivity(
    workspaceId,
    current.task_id,
    isCompleted ? 'task.checklist_completed' : 'task.checklist_reopened',
    actorMemberId,
    { checklist_item_id: itemId },
    client,
  )
  return data
}

export async function deleteChecklistItem(
  workspaceId: string,
  itemId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const current = await getChecklistItem(workspaceId, itemId, client)
  const { error } = await client.from('task_checklist_items').delete()
    .eq('workspace_id', workspaceId).eq('id', itemId)
  if (error) throw mapTaskError(error)
  await recordTaskActivity(workspaceId, current.task_id, 'task.checklist_deleted', actorMemberId, { checklist_item_id: itemId }, client)
}

export async function reorderChecklistItems(
  workspaceId: string,
  taskId: string,
  itemIds: string[],
  client: SupabaseClient<Database> = supabase,
): Promise<TaskChecklistItem[]> {
  const current = await listChecklistItems(workspaceId, taskId, client)
  const orderedIds = checklistReorderSchema.parse(itemIds)
  if (current.length !== orderedIds.length || current.some(({ id }) => !orderedIds.includes(id))) {
    throw new DomainError('A ordenação deve conter todos os itens da checklist da tarefa.', 'CHECKLIST_REORDER_INVALID')
  }
  const offset = Math.max(...current.map(({ position }) => position)) + current.length
  for (const item of current) {
    const { error } = await client.from('task_checklist_items').update({ position: item.position + offset })
      .eq('workspace_id', workspaceId).eq('id', item.id)
    if (error) throw mapTaskError(error)
  }
  const byId = new Map(current.map((item) => [item.id, item]))
  const reordered: TaskChecklistItem[] = []
  for (const [index, itemId] of orderedIds.entries()) {
    const { error } = await client.from('task_checklist_items').update({ position: index + 1 })
      .eq('workspace_id', workspaceId).eq('id', itemId)
    if (error) throw mapTaskError(error)
    reordered.push({ ...byId.get(itemId)!, position: index + 1 })
  }
  return reordered
}
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { taskTypeSchema, taskTypeUpdateSchema } from '@/domains/workflows/schemas/task-type-schema'
import type { TaskType, TaskTypeInput } from '@/domains/workflows/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export async function listTaskTypes(
  workspaceId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<TaskType[]> {
  requireWorkspace(workspaceId)
  let query = client.from('task_types').select('*').eq('workspace_id', workspaceId)
  if (options.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query.order('name')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function getTaskType(
  workspaceId: string,
  taskTypeId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskType> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('task_types').select('*')
    .eq('workspace_id', workspaceId).eq('id', taskTypeId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Tipo de tarefa não encontrado neste workspace.', 'TASK_TYPE_NOT_FOUND')
  return data
}

export async function createTaskType(
  workspaceId: string,
  values: TaskTypeInput,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskType> {
  requireWorkspace(workspaceId)
  const parsedValues = taskTypeSchema.parse(values)
  const { data, error } = await client.from('task_types').insert({
    ...parsedValues,
    workspace_id: workspaceId,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar o tipo de tarefa.', 'TASK_TYPE_CREATE_FAILED')
  return data
}

export async function updateTaskType(
  workspaceId: string,
  taskTypeId: string,
  values: Partial<TaskTypeInput>,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskType> {
  const current = await getTaskType(workspaceId, taskTypeId, client)
  const parsedValues = taskTypeUpdateSchema.parse(values)
  if (Object.keys(parsedValues).length === 0) return current
  const { data, error } = await client.from('task_types').update(parsedValues)
    .eq('workspace_id', workspaceId).eq('id', taskTypeId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Tipo de tarefa não encontrado neste workspace.', 'TASK_TYPE_NOT_FOUND')
  return data ?? current
}

export async function setTaskTypeActive(
  workspaceId: string,
  taskTypeId: string,
  isActive: boolean,
  client: SupabaseClient<Database> = supabase,
) {
  return updateTaskType(workspaceId, taskTypeId, { is_active: isActive }, client)
}
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { createSafeReorderPlan } from '@/domains/workflows/helpers/position-order'
import { taskTypeDepartmentSchema, taskTypeDepartmentUpdateSchema, reorderSchema } from '@/domains/workflows/schemas/task-type-department-schema'
import { getDepartment } from '@/domains/workflows/services/department-service'
import { getTaskType } from '@/domains/workflows/services/task-type-service'
import type { TaskTypeDepartment } from '@/domains/workflows/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export async function listTaskTypeDepartments(
  workspaceId: string,
  taskTypeId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<TaskTypeDepartment[]> {
  requireWorkspace(workspaceId)
  if (options.activeOnly) {
    const taskType = await getTaskType(workspaceId, taskTypeId, client)
    if (!taskType.is_active) return []
  }
  let query = client.from('task_type_departments').select('*')
    .eq('workspace_id', workspaceId).eq('task_type_id', taskTypeId)
  if (options.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query.order('position')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function addDepartmentToTaskType(
  workspaceId: string,
  taskTypeId: string,
  values: { department_id: string; position?: number; is_active?: boolean },
  client: SupabaseClient<Database> = supabase,
): Promise<TaskTypeDepartment> {
  requireWorkspace(workspaceId)
  const parsed = taskTypeDepartmentSchema.parse(values)
  await Promise.all([
    getTaskType(workspaceId, taskTypeId, client),
    getDepartment(workspaceId, parsed.department_id, client),
  ])
  const associations = await listTaskTypeDepartments(workspaceId, taskTypeId, {}, client)
  const position = parsed.position ?? Math.max(0, ...associations.map(({ position: current }) => current)) + 1
  const { data, error } = await client.from('task_type_departments').insert({
    workspace_id: workspaceId,
    task_type_id: taskTypeId,
    department_id: parsed.department_id,
    position,
    is_active: parsed.is_active,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível adicionar o departamento ao fluxo.', 'TASK_TYPE_DEPARTMENT_CREATE_FAILED')
  return data
}

export async function updateTaskTypeDepartment(
  workspaceId: string,
  taskTypeId: string,
  associationId: string,
  values: { is_active?: boolean },
  client: SupabaseClient<Database> = supabase,
): Promise<TaskTypeDepartment> {
  requireWorkspace(workspaceId)
  const parsed = taskTypeDepartmentUpdateSchema.parse(values)
  const { data, error } = await client.from('task_type_departments').update(parsed)
    .eq('workspace_id', workspaceId).eq('task_type_id', taskTypeId).eq('id', associationId).select('*').maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Vínculo Tipo×Departamento não encontrado neste workspace.', 'TASK_TYPE_DEPARTMENT_NOT_FOUND')
  return data
}

export async function deactivateTaskTypeDepartment(
  workspaceId: string,
  taskTypeId: string,
  associationId: string,
  client: SupabaseClient<Database> = supabase,
) {
  return updateTaskTypeDepartment(workspaceId, taskTypeId, associationId, { is_active: false }, client)
}

export async function isDepartmentInTaskType(
  workspaceId: string,
  taskTypeId: string,
  departmentId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  if (options.activeOnly) {
    const taskType = await getTaskType(workspaceId, taskTypeId, client)
    if (!taskType.is_active) return false
  }
  let query = client.from('task_type_departments').select('id')
    .eq('workspace_id', workspaceId).eq('task_type_id', taskTypeId).eq('department_id', departmentId)
  if (options.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query.maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data || !options.activeOnly) return Boolean(data)

  const { data: department, error: departmentError } = await client.from('departments').select('id')
    .eq('workspace_id', workspaceId).eq('id', departmentId).eq('is_active', true).maybeSingle()
  if (departmentError) throw mapDatabaseError(departmentError)
  return Boolean(department)
}

export async function reorderTaskTypeDepartments(
  workspaceId: string,
  taskTypeId: string,
  input: { orderedIds: string[] },
  client: SupabaseClient<Database> = supabase,
): Promise<TaskTypeDepartment[]> {
  requireWorkspace(workspaceId)
  const { orderedIds } = reorderSchema.parse(input)
  const associations = await listTaskTypeDepartments(workspaceId, taskTypeId, {}, client)
  const plan = createSafeReorderPlan(associations, orderedIds)

  for (const operation of plan.moveToTemporaryPositions) {
    const { error } = await client.from('task_type_departments').update({ position: operation.position })
      .eq('workspace_id', workspaceId).eq('task_type_id', taskTypeId).eq('id', operation.id)
    if (error) throw mapDatabaseError(error)
  }
  for (const operation of plan.moveToFinalPositions) {
    const { error } = await client.from('task_type_departments').update({ position: operation.position })
      .eq('workspace_id', workspaceId).eq('task_type_id', taskTypeId).eq('id', operation.id)
    if (error) throw mapDatabaseError(error)
  }

  return listTaskTypeDepartments(workspaceId, taskTypeId, {}, client)
}

export async function moveTaskTypeDepartment(
  workspaceId: string,
  taskTypeId: string,
  associationId: string,
  position: number,
  client: SupabaseClient<Database> = supabase,
) {
  const associations = await listTaskTypeDepartments(workspaceId, taskTypeId, {}, client)
  const orderedIds = associations.sort((left, right) => left.position - right.position).map(({ id }) => id)
  const currentIndex = orderedIds.indexOf(associationId)
  if (currentIndex < 0) throw new DomainError('Vínculo Tipo×Departamento não encontrado neste workspace.', 'TASK_TYPE_DEPARTMENT_NOT_FOUND')
  if (!Number.isInteger(position) || position < 1 || position > orderedIds.length) {
    throw new DomainError('A posição solicitada está fora da ordem atual do fluxo.', 'INVALID_REORDER')
  }
  orderedIds.splice(currentIndex, 1)
  orderedIds.splice(position - 1, 0, associationId)
  return reorderTaskTypeDepartments(workspaceId, taskTypeId, { orderedIds }, client)
}
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { departmentSchema, departmentUpdateSchema } from '@/domains/workflows/schemas/department-schema'
import type { Department, DepartmentInput } from '@/domains/workflows/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export async function listDepartments(
  workspaceId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<Department[]> {
  requireWorkspace(workspaceId)
  let query = client.from('departments').select('*').eq('workspace_id', workspaceId)
  if (options.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query.order('name')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function getDepartment(
  workspaceId: string,
  departmentId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Department> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('departments').select('*')
    .eq('workspace_id', workspaceId).eq('id', departmentId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Departamento não encontrado neste workspace.', 'DEPARTMENT_NOT_FOUND')
  return data
}

export async function createDepartment(
  workspaceId: string,
  values: DepartmentInput,
  client: SupabaseClient<Database> = supabase,
): Promise<Department> {
  requireWorkspace(workspaceId)
  const parsedValues = departmentSchema.parse(values)
  const { data, error } = await client.from('departments').insert({
    ...parsedValues,
    workspace_id: workspaceId,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar o departamento.', 'DEPARTMENT_CREATE_FAILED')
  return data
}

export async function updateDepartment(
  workspaceId: string,
  departmentId: string,
  values: Partial<DepartmentInput>,
  client: SupabaseClient<Database> = supabase,
): Promise<Department> {
  requireWorkspace(workspaceId)
  await getDepartment(workspaceId, departmentId, client)
  const parsedValues = departmentUpdateSchema.parse(values)
  if (Object.keys(parsedValues).length === 0) return getDepartment(workspaceId, departmentId, client)
  const { data, error } = await client.from('departments').update(parsedValues)
    .eq('workspace_id', workspaceId).eq('id', departmentId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Departamento não encontrado neste workspace.', 'DEPARTMENT_NOT_FOUND')
  return data
}

export async function setDepartmentActive(
  workspaceId: string,
  departmentId: string,
  isActive: boolean,
  client: SupabaseClient<Database> = supabase,
) {
  return updateDepartment(workspaceId, departmentId, { is_active: isActive }, client)
}
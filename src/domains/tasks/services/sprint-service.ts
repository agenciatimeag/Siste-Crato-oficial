import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { sprintSchema, sprintUpdateSchema } from '@/domains/tasks/schemas/sprint-schema'
import type { Sprint } from '@/domains/tasks/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export async function listSprints(
  workspaceId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<Sprint[]> {
  requireWorkspace(workspaceId)
  let query = client.from('sprints').select('*').eq('workspace_id', workspaceId)
  if (options.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query.order('start_date', { ascending: false, nullsFirst: false }).order('name')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function getSprint(
  workspaceId: string,
  sprintId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Sprint> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('sprints').select('*')
    .eq('workspace_id', workspaceId).eq('id', sprintId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Sprint não encontrada neste workspace.', 'SPRINT_NOT_FOUND')
  return data
}

export async function createSprint(
  workspaceId: string,
  values: { name: string; start_date?: string | null; end_date?: string | null; is_active?: boolean },
  client: SupabaseClient<Database> = supabase,
): Promise<Sprint> {
  requireWorkspace(workspaceId)
  const parsed = sprintSchema.parse(values)
  const { data, error } = await client.from('sprints').insert({ ...parsed, workspace_id: workspaceId })
    .select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar a Sprint.', 'SPRINT_CREATE_FAILED')
  return data
}

export async function updateSprint(
  workspaceId: string,
  sprintId: string,
  values: Partial<Pick<Sprint, 'name' | 'start_date' | 'end_date' | 'is_active'>>,
  client: SupabaseClient<Database> = supabase,
): Promise<Sprint> {
  const current = await getSprint(workspaceId, sprintId, client)
  const parsed = sprintUpdateSchema.parse({ ...current, ...values })
  const payload = Object.fromEntries(Object.keys(values).map((key) => [key, parsed[key as keyof typeof parsed]])) as Partial<
    Pick<Sprint, 'name' | 'start_date' | 'end_date' | 'is_active'>
  >
  if (Object.keys(payload).length === 0) return current
  const { data, error } = await client.from('sprints').update(payload)
    .eq('workspace_id', workspaceId).eq('id', sprintId).select('*').maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Sprint não encontrada neste workspace.', 'SPRINT_NOT_FOUND')
  return data
}

export async function setSprintActive(
  workspaceId: string,
  sprintId: string,
  isActive: boolean,
  client: SupabaseClient<Database> = supabase,
) {
  return updateSprint(workspaceId, sprintId, { is_active: isActive }, client)
}

export async function activateSprint(
  workspaceId: string,
  sprintId: string,
  client: SupabaseClient<Database> = supabase,
) {
  return setSprintActive(workspaceId, sprintId, true, client)
}

export async function deactivateSprint(
  workspaceId: string,
  sprintId: string,
  client: SupabaseClient<Database> = supabase,
) {
  return setSprintActive(workspaceId, sprintId, false, client)
}
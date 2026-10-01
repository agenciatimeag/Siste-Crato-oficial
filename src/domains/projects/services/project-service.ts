import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { recordActivity } from '@/domains/activity/activity-service'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import type { Project, ProjectInput } from '@/domains/projects/types'
import { projectSchema, projectStatusSchema } from '@/domains/projects/schemas/project-schema'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

async function ensureClient(workspaceId: string, clientId: string, client: SupabaseClient<Database>) {
  const { data, error } = await client.from('clients').select('id')
    .eq('workspace_id', workspaceId).eq('id', clientId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Cliente não encontrado neste workspace.', 'CLIENT_NOT_FOUND')
}

function projectPayload(values: ProjectInput, existing?: Project) {
  return {
    client_id: values.client_id,
    name: values.name.trim(),
    description: values.description?.trim() || null,
    status: values.status ?? 'active',
    start_date: values.start_date ?? existing?.start_date,
    planned_end_date: values.planned_end_date ?? null,
    completed_at: values.completed_at ?? null,
    owner_member_id: values.owner_member_id ?? null,
    notes: values.notes?.trim() || null,
  }
}

export async function listClientProjects(
  workspaceId: string,
  clientId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Project[]> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('projects').select('*')
    .eq('workspace_id', workspaceId).eq('client_id', clientId).order('name')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function getProject(
  workspaceId: string,
  projectId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Project> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('projects').select('*')
    .eq('workspace_id', workspaceId).eq('id', projectId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Projeto não encontrado neste workspace.', 'PROJECT_NOT_FOUND')
  return data
}

export async function createProject(
  workspaceId: string,
  values: ProjectInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Project> {
  requireWorkspace(workspaceId)
  const parsedValues = projectSchema.parse(values)
  await ensureClient(workspaceId, parsedValues.client_id, client)
  const { data, error } = await client.from('projects').insert({
    ...projectPayload(parsedValues),
    workspace_id: workspaceId,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar o projeto.', 'PROJECT_CREATE_FAILED')
  await recordActivity({
    workspaceId,
    entityType: 'project',
    entityId: data.id,
    action: 'project.created',
    actorMemberId,
    metadata: { client_id: data.client_id, name: data.name },
  }, client)
  return data
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  values: Partial<ProjectInput>,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Project> {
  const current = await getProject(workspaceId, projectId, client)
  const parsedValues = projectSchema.parse({ ...current, ...values })
  await ensureClient(workspaceId, parsedValues.client_id, client)
  const payload = projectPayload(parsedValues, current)
  const hasChanges = Object.entries(payload).some(([field, value]) =>
    value !== undefined && current[field as keyof Project] !== value,
  )
  if (!hasChanges) return current

  const { data, error } = await client.from('projects').update(payload)
    .eq('workspace_id', workspaceId).eq('id', projectId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Projeto não encontrado neste workspace.', 'PROJECT_NOT_FOUND')
  await recordActivity({
    workspaceId,
    entityType: 'project',
    entityId: data.id,
    action: 'project.updated',
    actorMemberId,
    metadata: { client_id: data.client_id, previous_client_id: current.client_id, name: data.name },
  }, client)
  return data
}

export async function changeProjectStatus(
  workspaceId: string,
  projectId: string,
  status: Project['status'],
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const parsedStatus = projectStatusSchema.parse(status)
  const current = await getProject(workspaceId, projectId, client)
  if (current.status === parsedStatus) return current
  const completedAt = parsedStatus === 'completed' ? new Date().toISOString() : null
  const { data, error } = await client.from('projects').update({ status: parsedStatus, completed_at: completedAt })
    .eq('workspace_id', workspaceId).eq('id', projectId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Projeto não encontrado neste workspace.', 'PROJECT_NOT_FOUND')
  await recordActivity({
    workspaceId,
    entityType: 'project',
    entityId: data.id,
    action: 'project.updated',
    actorMemberId,
    metadata: { previous_status: current.status, status: parsedStatus },
  }, client)
  return data
}
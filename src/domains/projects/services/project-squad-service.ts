import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { recordActivity } from '@/domains/activity/activity-service'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import type { ProjectMember, ProjectMemberInput } from '@/domains/projects/types'
import { projectMemberSchema, projectMemberUpdateSchema } from '@/domains/projects/schemas/project-schema'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

async function ensureProject(workspaceId: string, projectId: string, client: SupabaseClient<Database>) {
  const { data, error } = await client.from('projects').select('id')
    .eq('workspace_id', workspaceId).eq('id', projectId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Projeto não encontrado neste workspace.', 'PROJECT_NOT_FOUND')
}

async function ensureActiveMember(workspaceId: string, memberId: string, client: SupabaseClient<Database>) {
  const { data, error } = await client.from('workspace_members').select('id')
    .eq('workspace_id', workspaceId).eq('id', memberId).eq('status', 'active').maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('O membro não está ativo neste workspace.', 'WORKSPACE_MEMBER_NOT_FOUND')
}

export async function listProjectSquad(
  workspaceId: string,
  projectId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<ProjectMember[]> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('project_members').select('*')
    .eq('workspace_id', workspaceId).eq('project_id', projectId)
    .order('is_lead', { ascending: false }).order('created_at')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function addProjectMember(
  workspaceId: string,
  projectId: string,
  values: ProjectMemberInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  const parsedValues = projectMemberSchema.parse(values)
  await ensureProject(workspaceId, projectId, client)
  await ensureActiveMember(workspaceId, parsedValues.member_id, client)
  const { data, error } = await client.from('project_members').insert({
    workspace_id: workspaceId,
    project_id: projectId,
    member_id: parsedValues.member_id,
    role_label: parsedValues.role_label,
    is_lead: parsedValues.is_lead,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível adicionar o membro ao projeto.', 'PROJECT_MEMBER_ADD_FAILED')
  await recordActivity({
    workspaceId,
    entityType: 'project',
    entityId: projectId,
    action: 'project.updated',
    actorMemberId,
    metadata: { squad_member_added: data.member_id, role_label: data.role_label, is_lead: data.is_lead },
  }, client)
  return data
}

export async function updateProjectMember(
  workspaceId: string,
  projectId: string,
  memberId: string,
  values: Pick<ProjectMemberInput, 'role_label' | 'is_lead'>,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  const parsedValues = projectMemberUpdateSchema.parse(values)
  const { data, error } = await client.from('project_members').update({
    role_label: parsedValues.role_label,
    is_lead: parsedValues.is_lead,
  }).eq('workspace_id', workspaceId).eq('project_id', projectId).eq('member_id', memberId)
    .select('*').maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('O membro não está no squad deste projeto.', 'PROJECT_MEMBER_NOT_FOUND')
  await recordActivity({
    workspaceId,
    entityType: 'project',
    entityId: projectId,
    action: 'project.updated',
    actorMemberId,
    metadata: { squad_member_updated: memberId, role_label: data.role_label, is_lead: data.is_lead },
  }, client)
  return data
}

export async function removeProjectMember(
  workspaceId: string,
  projectId: string,
  memberId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('project_members').delete()
    .eq('workspace_id', workspaceId).eq('project_id', projectId).eq('member_id', memberId)
    .select('member_id').maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('O membro não está no squad deste projeto.', 'PROJECT_MEMBER_NOT_FOUND')
  await recordActivity({
    workspaceId,
    entityType: 'project',
    entityId: projectId,
    action: 'project.updated',
    actorMemberId,
    metadata: { squad_member_removed: memberId },
  }, client)
}
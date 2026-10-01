import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { createSafeReorderPlan } from '@/domains/workflows/helpers/position-order'
import { workflowStepSchema, workflowStepUpdateSchema } from '@/domains/workflows/schemas/workflow-step-schema'
import { reorderSchema } from '@/domains/workflows/schemas/task-type-department-schema'
import { getWorkflowStep, listWorkflowSteps } from '@/domains/workflows/queries/workflow-queries'
import type { WorkflowStep, WorkflowStepInput } from '@/domains/workflows/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

async function ensureAssociation(workspaceId: string, associationId: string, client: SupabaseClient<Database>) {
  const { data, error } = await client.from('task_type_departments').select('id')
    .eq('workspace_id', workspaceId).eq('id', associationId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('O vínculo Tipo×Departamento não existe neste workspace.', 'TASK_TYPE_DEPARTMENT_NOT_FOUND')
}

export async function createWorkflowStep(
  workspaceId: string,
  taskTypeDepartmentId: string,
  values: WorkflowStepInput,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowStep> {
  requireWorkspace(workspaceId)
  await ensureAssociation(workspaceId, taskTypeDepartmentId, client)
  const parsedValues = workflowStepSchema.parse(values)
  const { data, error } = await client.from('workflow_steps').insert({
    ...parsedValues,
    workspace_id: workspaceId,
    task_type_department_id: taskTypeDepartmentId,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar a etapa.', 'WORKFLOW_STEP_CREATE_FAILED')
  return data
}

export async function updateWorkflowStep(
  workspaceId: string,
  workflowStepId: string,
  values: Partial<WorkflowStepInput>,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowStep> {
  const current = await getWorkflowStep(workspaceId, workflowStepId, client)
  const parsedValues = workflowStepUpdateSchema.parse(values)
  const { position, ...editableFields } = parsedValues
  let updated = current

  if (position !== undefined && position !== current.position) {
    const siblingSteps = await listWorkflowSteps(workspaceId, current.task_type_department_id, {}, client)
    if (position < 1 || position > siblingSteps.length) {
      throw new DomainError('A posição solicitada está fora da ordem atual das etapas.', 'INVALID_REORDER')
    }
  }

  if (Object.keys(editableFields).length > 0) {
    const { data, error } = await client.from('workflow_steps').update(editableFields)
      .eq('workspace_id', workspaceId).eq('id', workflowStepId).select('*').maybeSingle()
    if (error) throw mapDatabaseError(error)
    if (!data) throw new DomainError('Etapa não encontrada neste workspace.', 'WORKFLOW_STEP_NOT_FOUND')
    updated = data
  }

  if (position !== undefined && position !== current.position) {
    await moveWorkflowStep(workspaceId, current.task_type_department_id, workflowStepId, position, client)
    updated = await getWorkflowStep(workspaceId, workflowStepId, client)
  }
  return updated
}

export async function setWorkflowStepActive(
  workspaceId: string,
  workflowStepId: string,
  isActive: boolean,
  client: SupabaseClient<Database> = supabase,
) {
  return updateWorkflowStep(workspaceId, workflowStepId, { is_active: isActive }, client)
}

export async function reorderWorkflowSteps(
  workspaceId: string,
  taskTypeDepartmentId: string,
  input: { orderedIds: string[] },
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowStep[]> {
  requireWorkspace(workspaceId)
  const { orderedIds } = reorderSchema.parse(input)
  const steps = await listWorkflowSteps(workspaceId, taskTypeDepartmentId, {}, client)
  const plan = createSafeReorderPlan(steps, orderedIds)

  for (const operation of plan.moveToTemporaryPositions) {
    const { error } = await client.from('workflow_steps').update({ position: operation.position })
      .eq('workspace_id', workspaceId).eq('task_type_department_id', taskTypeDepartmentId).eq('id', operation.id)
    if (error) throw mapDatabaseError(error)
  }
  for (const operation of plan.moveToFinalPositions) {
    const { error } = await client.from('workflow_steps').update({ position: operation.position })
      .eq('workspace_id', workspaceId).eq('task_type_department_id', taskTypeDepartmentId).eq('id', operation.id)
    if (error) throw mapDatabaseError(error)
  }

  return listWorkflowSteps(workspaceId, taskTypeDepartmentId, {}, client)
}

export async function moveWorkflowStep(
  workspaceId: string,
  taskTypeDepartmentId: string,
  workflowStepId: string,
  position: number,
  client: SupabaseClient<Database> = supabase,
) {
  const steps = await listWorkflowSteps(workspaceId, taskTypeDepartmentId, {}, client)
  const orderedIds = steps.sort((left, right) => left.position - right.position).map(({ id }) => id)
  const currentIndex = orderedIds.indexOf(workflowStepId)
  if (currentIndex < 0) throw new DomainError('Etapa não pertence a este vínculo Tipo×Departamento.', 'WORKFLOW_STEP_NOT_IN_DEPARTMENT')
  if (!Number.isInteger(position) || position < 1 || position > orderedIds.length) {
    throw new DomainError('A posição solicitada está fora da ordem atual das etapas.', 'INVALID_REORDER')
  }
  orderedIds.splice(currentIndex, 1)
  orderedIds.splice(position - 1, 0, workflowStepId)
  return reorderWorkflowSteps(workspaceId, taskTypeDepartmentId, { orderedIds }, client)
}
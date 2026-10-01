import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { getDepartment } from '@/domains/workflows/services/department-service'
import { getTaskType } from '@/domains/workflows/services/task-type-service'
import { getFirstDepartmentFromWorkflow, getFirstStepForDepartmentFromWorkflow, getFirstStepFromWorkflow, resolveTaskTypeChangeFromWorkflow, resolveWorkflowPositionFromWorkflow, validateWorkflowPositionInWorkflow } from '@/domains/workflows/helpers/workflow-resolution'
import type { Department, TaskTypeWorkflow, WorkflowPosition, WorkflowStep } from '@/domains/workflows/types'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

export async function getWorkflowForTaskType(
  workspaceId: string,
  taskTypeId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<TaskTypeWorkflow> {
  requireWorkspace(workspaceId)
  const taskType = await getTaskType(workspaceId, taskTypeId, client)
  if (options.activeOnly && !taskType.is_active) return { taskType, departments: [] }
  let associationsQuery = client.from('task_type_departments').select('*')
    .eq('workspace_id', workspaceId).eq('task_type_id', taskTypeId)
  if (options.activeOnly) associationsQuery = associationsQuery.eq('is_active', true)
  const { data: associations, error: associationsError } = await associationsQuery.order('position')
  if (associationsError) throw mapDatabaseError(associationsError)
  if (!associations?.length) return { taskType, departments: [] }

  const associationIds = associations.map(({ id }) => id)
  const departmentIds = [...new Set(associations.map(({ department_id }) => department_id))]
  let departmentsQuery = client.from('departments').select('*')
    .eq('workspace_id', workspaceId).in('id', departmentIds)
  if (options.activeOnly) departmentsQuery = departmentsQuery.eq('is_active', true)
  const { data: departments, error: departmentsError } = await departmentsQuery
  if (departmentsError) throw mapDatabaseError(departmentsError)

  let stepsQuery = client.from('workflow_steps').select('*')
    .eq('workspace_id', workspaceId).in('task_type_department_id', associationIds)
  if (options.activeOnly) stepsQuery = stepsQuery.eq('is_active', true)
  const { data: steps, error: stepsError } = await stepsQuery.order('position')
  if (stepsError) throw mapDatabaseError(stepsError)

  const departmentsById = new Map((departments ?? []).map((department) => [department.id, department]))
  const stepsByAssociationId = new Map<string, WorkflowStep[]>()
  for (const step of steps ?? []) {
    const group = stepsByAssociationId.get(step.task_type_department_id) ?? []
    group.push(step)
    stepsByAssociationId.set(step.task_type_department_id, group)
  }

  const workflowDepartments = associations.flatMap((association) => {
    const department = departmentsById.get(association.department_id)
    if (!department) return []
    return [{
      association,
      department,
      steps: (stepsByAssociationId.get(association.id) ?? [])
        .sort((left, right) => left.position - right.position),
    }]
  }).sort((left, right) => left.association.position - right.association.position)

  return { taskType, departments: workflowDepartments }
}

export async function getDepartmentsForTaskType(
  workspaceId: string,
  taskTypeId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
) {
  const workflow = await getWorkflowForTaskType(workspaceId, taskTypeId, options, client)
  return workflow.departments
}

export async function getStepsForDepartment(
  workspaceId: string,
  taskTypeId: string,
  departmentId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowStep[]> {
  const workflow = await getWorkflowForTaskType(workspaceId, taskTypeId, {}, client)
  if (options.activeOnly && !workflow.taskType.is_active) return []
  const flowDepartment = workflow.departments.find(({ department }) => department.id === departmentId)
  if (!flowDepartment) {
    await getDepartment(workspaceId, departmentId, client)
    throw new DomainError('Este departamento não pertence ao fluxo deste tipo de tarefa.', 'DEPARTMENT_NOT_IN_TASK_TYPE')
  }
  if (!options.activeOnly) return flowDepartment.steps
  if (!flowDepartment.association.is_active || !flowDepartment.department.is_active) return []
  return flowDepartment.steps.filter((step) => step.is_active)
}

export async function listWorkflowSteps(
  workspaceId: string,
  taskTypeDepartmentId: string,
  options: { activeOnly?: boolean } = {},
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowStep[]> {
  requireWorkspace(workspaceId)
  const { data: association, error: associationError } = await client.from('task_type_departments').select('id, task_type_id, department_id, is_active')
    .eq('workspace_id', workspaceId).eq('id', taskTypeDepartmentId).maybeSingle()
  if (associationError) throw mapDatabaseError(associationError)
  if (!association) throw new DomainError('O vínculo Tipo×Departamento não existe neste workspace.', 'TASK_TYPE_DEPARTMENT_NOT_FOUND')
  if (options.activeOnly) {
    if (!association.is_active) return []
    const [taskType, department] = await Promise.all([
      getTaskType(workspaceId, association.task_type_id, client),
      getDepartment(workspaceId, association.department_id, client),
    ])
    if (!taskType.is_active || !department.is_active) return []
  }

  let query = client.from('workflow_steps').select('*')
    .eq('workspace_id', workspaceId).eq('task_type_department_id', taskTypeDepartmentId)
  if (options.activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query.order('position')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function getWorkflowStep(
  workspaceId: string,
  workflowStepId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowStep> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('workflow_steps').select('*')
    .eq('workspace_id', workspaceId).eq('id', workflowStepId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Etapa não encontrada neste workspace.', 'WORKFLOW_STEP_NOT_FOUND')
  return data
}

export async function getFirstDepartment(
  workspaceId: string,
  taskTypeId: string,
  client: SupabaseClient<Database> = supabase,
) {
  return getFirstDepartmentFromWorkflow(await getWorkflowForTaskType(workspaceId, taskTypeId, {}, client))
}

export async function getFirstStep(
  workspaceId: string,
  taskTypeId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowPosition> {
  return getFirstStepFromWorkflow(await getWorkflowForTaskType(workspaceId, taskTypeId, {}, client))
}

export async function getFirstStepForDepartment(
  workspaceId: string,
  taskTypeId: string,
  departmentId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowPosition> {
  return getFirstStepForDepartmentFromWorkflow(
    await getWorkflowForTaskType(workspaceId, taskTypeId, {}, client),
    departmentId,
  )
}

export async function validateWorkflowPosition(
  workspaceId: string,
  taskTypeId: string,
  workflowStepId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowPosition> {
  return validateWorkflowPositionInWorkflow(
    await getWorkflowForTaskType(workspaceId, taskTypeId, {}, client),
    { taskTypeId, workflowStepId },
  )
}

export async function resolveWorkflowPosition(
  workspaceId: string,
  input: { taskTypeId: string; departmentId?: string; workflowStepId?: string },
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowPosition> {
  return resolveWorkflowPositionFromWorkflow(
    await getWorkflowForTaskType(workspaceId, input.taskTypeId, {}, client),
    input,
  )
}

export async function resolveTaskTypeChange(
  workspaceId: string,
  newTaskTypeId: string,
  currentWorkflowStepId: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowPosition> {
  return resolveTaskTypeChangeFromWorkflow(
    await getWorkflowForTaskType(workspaceId, newTaskTypeId, {}, client),
    currentWorkflowStepId,
  )
}

export async function resolveDepartmentChange(
  workspaceId: string,
  taskTypeId: string,
  departmentId: string,
  workflowStepId?: string,
  client: SupabaseClient<Database> = supabase,
): Promise<WorkflowPosition> {
  return resolveWorkflowPosition(workspaceId, { taskTypeId, departmentId, workflowStepId }, client)
}

export type { Department }
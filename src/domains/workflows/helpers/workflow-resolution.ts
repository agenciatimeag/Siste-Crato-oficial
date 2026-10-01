import { DomainError } from '@/domains/shared/domain-error'
import { invalidWorkflowPosition, workflowNotConfigured } from '@/domains/workflows/helpers/workflow-error'
import type { TaskTypeWorkflow, WorkflowDepartment, WorkflowPosition } from '@/domains/workflows/types'

export type ResolveWorkflowPositionInput = {
  taskTypeId: string
  departmentId?: string
  workflowStepId?: string
}

function activeDepartments(workflow: TaskTypeWorkflow): WorkflowDepartment[] {
  return workflow.departments
    .filter(({ association, department }) => association.is_active && department.is_active)
    .sort((left, right) => left.association.position - right.association.position)
}

export function getDepartmentsForTaskTypeFromWorkflow(workflow: TaskTypeWorkflow, activeOnly = true) {
  if (activeOnly && !workflow.taskType.is_active) return []
  return (activeOnly ? activeDepartments(workflow) : [...workflow.departments])
    .sort((left, right) => left.association.position - right.association.position)
}

export function getStepsForDepartmentFromWorkflow(
  workflow: TaskTypeWorkflow,
  departmentId: string,
  activeOnly = true,
) {
  if (activeOnly && !workflow.taskType.is_active) return []
  const flowDepartment = (activeOnly ? activeDepartments(workflow) : workflow.departments)
    .find(({ department }) => department.id === departmentId)
  if (!flowDepartment) return []
  return (activeOnly ? flowDepartment.steps.filter((step) => step.is_active) : [...flowDepartment.steps])
    .sort((left, right) => left.position - right.position)
}

export function getFirstDepartmentFromWorkflow(workflow: TaskTypeWorkflow): WorkflowDepartment {
  if (!workflow.taskType.is_active) {
    throw new DomainError('Este tipo de tarefa está inativo.', 'TASK_TYPE_INACTIVE')
  }
  const firstDepartment = activeDepartments(workflow)
    .sort((left, right) => left.association.position - right.association.position)[0]
  if (!firstDepartment) throw workflowNotConfigured()
  return firstDepartment
}

export function getFirstStepFromWorkflow(workflow: TaskTypeWorkflow): WorkflowPosition {
  const firstDepartment = getFirstDepartmentFromWorkflow(workflow)
  const workflowStep = firstDepartment.steps.filter((step) => step.is_active)
    .sort((left, right) => left.position - right.position)[0]
  if (!workflowStep) throw workflowNotConfigured()
  return { association: firstDepartment.association, department: firstDepartment.department, workflowStep }
}

export function getFirstStepForDepartmentFromWorkflow(
  workflow: TaskTypeWorkflow,
  departmentId: string,
): WorkflowPosition {
  if (!workflow.taskType.is_active) {
    throw new DomainError('Este tipo de tarefa está inativo.', 'TASK_TYPE_INACTIVE')
  }
  const anyDepartment = workflow.departments.find(({ department: candidate }) => candidate.id === departmentId)
  if (!anyDepartment) {
    throw new DomainError('Este departamento não pertence ao fluxo deste tipo de tarefa.', 'DEPARTMENT_NOT_IN_TASK_TYPE')
  }
  if (!anyDepartment.association.is_active || !anyDepartment.department.is_active) {
    throw new DomainError('Este departamento está inativo neste fluxo.', 'WORKFLOW_DEPARTMENT_INACTIVE')
  }
  const department = anyDepartment
  const workflowStep = department.steps.filter((step) => step.is_active)
    .sort((left, right) => left.position - right.position)[0]
  if (!workflowStep) throw workflowNotConfigured()
  return { association: department.association, department: department.department, workflowStep }
}

export function validateWorkflowPositionInWorkflow(
  workflow: TaskTypeWorkflow,
  input: ResolveWorkflowPositionInput,
): WorkflowPosition {
  if (input.taskTypeId !== workflow.taskType.id || !workflow.taskType.is_active) {
    throw invalidWorkflowPosition()
  }
  const position = workflow.departments.flatMap((flowDepartment) =>
    flowDepartment.steps.map((workflowStep) => ({ ...flowDepartment, workflowStep })),
  ).find(({ workflowStep }) => workflowStep.id === input.workflowStepId)

  if (
    !position
    || !position.association.is_active
    || !position.department.is_active
    || !position.workflowStep.is_active
    || (input.departmentId && position.department.id !== input.departmentId)
  ) {
    throw invalidWorkflowPosition()
  }

  return {
    association: position.association,
    department: position.department,
    workflowStep: position.workflowStep,
  }
}

export function resolveWorkflowPositionFromWorkflow(
  workflow: TaskTypeWorkflow,
  input: ResolveWorkflowPositionInput,
): WorkflowPosition {
  if (input.taskTypeId !== workflow.taskType.id || !workflow.taskType.is_active) {
    throw new DomainError('O tipo de tarefa não está ativo neste workspace.', 'TASK_TYPE_NOT_ACTIVE')
  }
  if (input.workflowStepId) return validateWorkflowPositionInWorkflow(workflow, input)
  if (input.departmentId) return getFirstStepForDepartmentFromWorkflow(workflow, input.departmentId)
  return getFirstStepFromWorkflow(workflow)
}

export function resolveTaskTypeChangeFromWorkflow(
  workflow: TaskTypeWorkflow,
  currentWorkflowStepId: string | null,
): WorkflowPosition {
  if (currentWorkflowStepId) {
    try {
      return validateWorkflowPositionInWorkflow(workflow, {
        taskTypeId: workflow.taskType.id,
        workflowStepId: currentWorkflowStepId,
      })
    } catch (error) {
      if (!(error instanceof DomainError) || error.code !== 'INVALID_WORKFLOW_POSITION') throw error
    }
  }
  return getFirstStepFromWorkflow(workflow)
}
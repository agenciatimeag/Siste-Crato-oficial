import type { OperationalNature, WorkflowStep } from '@/domains/workflows/types'
import type { Task } from '@/domains/tasks/types'

export function getTaskOperationalNature(_task: Task, workflowStep: WorkflowStep): OperationalNature {
  return workflowStep.operational_nature
}

export function isTaskComplete(_task: Task, workflowStep: WorkflowStep) {
  return workflowStep.operational_nature === 'complete'
}
import type { Database } from '@/lib/supabase/database.types'

export type TaskType = Database['public']['Tables']['task_types']['Row']
export type Department = Database['public']['Tables']['departments']['Row']
export type TaskTypeDepartment = Database['public']['Tables']['task_type_departments']['Row']
export type WorkflowStep = Database['public']['Tables']['workflow_steps']['Row']
export type OperationalNature = WorkflowStep['operational_nature']

export type WorkflowDepartment = {
  association: TaskTypeDepartment
  department: Department
  steps: WorkflowStep[]
}

export type TaskTypeWorkflow = {
  taskType: TaskType
  departments: WorkflowDepartment[]
}

export type WorkflowPosition = {
  association: TaskTypeDepartment
  department: Department
  workflowStep: WorkflowStep
}

export type TaskTypeInput = {
  name: string
  description?: string | null
  is_active?: boolean
}

export type DepartmentInput = TaskTypeInput

export type TaskTypeDepartmentInput = {
  department_id: string
  position?: number
  is_active?: boolean
}

export type WorkflowStepInput = {
  name: string
  position: number
  operational_nature?: OperationalNature
  is_internal_review?: boolean
  is_external_review?: boolean
  is_revision?: boolean
  starts_timesheet?: boolean
  stops_timesheet?: boolean
  estimated_minutes?: number | null
  is_active?: boolean
}

export type OrderedPosition = {
  id: string
  position: number
}
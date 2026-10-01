import type { Database } from '@/lib/supabase/database.types'
import type { Client } from '@/domains/clients/types'
import type { Department } from '@/domains/workflows/types'
import type { Project } from '@/domains/projects/types'
import type { TaskType, WorkflowStep } from '@/domains/workflows/types'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskPriority = Task['priority']
export type TaskMember = Database['public']['Tables']['workspace_members']['Row']
export type TaskMemberDetails = {
  member: TaskMember
  profile: Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'avatar_url'> | null
}

export type TaskCreateInput = {
  project_id: string
  task_type_id: string
  workflow_step_id?: string | null
  department_id?: string | null
  parent_task_id?: string | null
  title: string
  briefing?: string | null
  final_copy?: string | null
  priority?: TaskPriority
  assignee_member_id?: string | null
  reviewer_member_id?: string | null
  start_date?: string | null
  due_date?: string | null
  publication_date?: string | null
  sort_order?: number
}

export type TaskSubtaskInput = Omit<TaskCreateInput, 'project_id' | 'parent_task_id'> & {
  project_id?: string
}

export type TaskUpdateInput = Partial<Pick<
  Task,
  | 'title'
  | 'briefing'
  | 'final_copy'
  | 'priority'
  | 'assignee_member_id'
  | 'reviewer_member_id'
  | 'start_date'
  | 'due_date'
  | 'publication_date'
  | 'sort_order'
>>

export type TaskListFilters = {
  projectId?: string
  assigneeMemberId?: string
  reviewerMemberId?: string
  taskTypeId?: string
  workflowStepId?: string
  parentTaskId?: string | null
  priority?: TaskPriority
  dueDateFrom?: string
  dueDateTo?: string
  publicationDateFrom?: string
  publicationDateTo?: string
  overdueOnly?: boolean
  overdueAsOf?: string
  includeArchived?: boolean
  archivedOnly?: boolean
  search?: string
}

export type TaskDetail = {
  task: Task
  project: Project
  client: Client
  taskType: TaskType
  department: Department
  workflowStep: WorkflowStep
  assignee: TaskMemberDetails | null
  reviewer: TaskMemberDetails | null
}
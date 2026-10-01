import type { Database } from '@/lib/supabase/database.types'
import type { Client } from '@/domains/clients/types'
import type { Department, OperationalNature, TaskType, WorkflowStep } from '@/domains/workflows/types'
import type { Project } from '@/domains/projects/types'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskPriority = Task['priority']
export type Sprint = Database['public']['Tables']['sprints']['Row']
export type TaskChecklistItem = Database['public']['Tables']['task_checklist_items']['Row']
export type TaskComment = Database['public']['Tables']['task_comments']['Row']
export type TaskFile = Database['public']['Tables']['task_files']['Row']
export type TaskSavedView = Database['public']['Tables']['task_saved_views']['Row']
export type TaskFileKind = TaskFile['kind']
export type TaskSavedViewType = TaskSavedView['view_type']
export type TaskSavedViewSort = {
  field: 'task_number' | 'title' | 'priority' | 'start_date' | 'execution_date' | 'due_date' | 'publication_date' | 'created_at'
  direction: 'asc' | 'desc'
}
export type TaskSavedViewGrouping =
  | 'none'
  | 'client'
  | 'project'
  | 'sprint'
  | 'assignee'
  | 'reviewer'
  | 'task_type'
  | 'department'
  | 'workflow_step'
  | 'priority'

export type TaskSavedViewColorMode =
  | 'default'
  | 'workflow'
  | 'client'
  | 'assignee'
  | 'priority'

export type TaskState = 'active' | 'completed' | 'archived' | 'all'

export type TaskSavedViewSettings = {
  filters?: TaskListFilters
  sorting?: TaskSavedViewSort[]
  grouping?: TaskSavedViewGrouping
  colorMode?: TaskSavedViewColorMode
  calendarDateMode?: 'start_date' | 'execution_date' | 'due_date' | 'publication_date'
  calendarView?: 'month' | 'week' | 'day'
  state?: TaskState
  includeCompleted?: boolean
  includeArchived?: boolean
  completionState?: 'all' | 'completed' | 'incomplete'
  archiveState?: 'all' | 'archived' | 'unarchived'
}
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
  sprint_id?: string | null
  title: string
  briefing?: string | null
  final_copy?: string | null
  priority?: TaskPriority
  assignee_member_id?: string | null
  reviewer_member_id?: string | null
  start_date?: string | null
  execution_date?: string | null
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
  | 'execution_date'
  | 'due_date'
  | 'publication_date'
  | 'sort_order'
>>

export type TaskListFilters = {
  clientId?: string
  projectId?: string
  sprintId?: string
  assigneeMemberId?: string
  reviewerMemberId?: string
  taskTypeId?: string
  departmentId?: string
  workflowStepId?: string
  parentTaskId?: string | null
  priority?: TaskPriority
  state?: TaskState
  status?: TaskState
  startDateFrom?: string
  startDateTo?: string
  dueDateFrom?: string
  dueDateTo?: string
  executionDateFrom?: string
  executionDateTo?: string
  publicationDateFrom?: string
  publicationDateTo?: string
  overdueOnly?: boolean
  overdueAsOf?: string
  includeArchived?: boolean
  archivedOnly?: boolean
  includeCompleted?: boolean
  completedOnly?: boolean
  search?: string
}

export type TaskDetail = {
  task: Task
  project: Project
  sprint: Sprint | null
  client: Client
  taskType: TaskType
  department: Department
  workflowStep: WorkflowStep
  assignee: TaskMemberDetails | null
  reviewer: TaskMemberDetails | null
}

export type TaskSummaryMember = {
  id: string
  nome: string
  name: string
  avatar: string | null
  avatar_url: string | null
}

export type TaskSummary = {
  id: string
  task_number: number
  title: string
  priority: TaskPriority
  start_date: string | null
  execution_date: string | null
  due_date: string | null
  publication_date: string | null
  completed_at: string | null
  archived_at: string | null
  project: {
    id: string
    name: string
  }
  client: {
    id: string
    name: string
  }
  type: {
    id: string
    name: string
  }
  taskType: {
    id: string
    name: string
  }
  department: {
    id: string
    name: string
  }
  step: {
    id: string
    name: string
    operational_nature: OperationalNature
  }
  workflowStep: {
    id: string
    name: string
    operational_nature: OperationalNature
  }
  assignee: TaskSummaryMember | null
  reviewer: TaskSummaryMember | null
  sprint: {
    id: string
    name: string
  } | null
  parent_task_id?: string | null
  sort_order?: number
}

export type TaskListItem = TaskSummary

export type CalendarDateMode = 'execution_date' | 'due_date'

export type CalendarQueryParams = {
  dateMode: CalendarDateMode
  rangeStart: string
  rangeEnd: string
  filters?: TaskListFilters
}

export type TaskDashboardOptions = {
  asOf?: string
  filters?: TaskListFilters
}

export type TaskDashboardData = {
  activeCount: number
  overdueCount: number
  dueTodayCount: number
  reviewCount: number
  waitingCount: number
  completedCount: number
  workloadByDay: Array<{ date: string; count: number }>
  workloadByAssignee: Array<{
    memberId: string | null
    name: string
    avatarUrl: string | null
    count: number
  }>
  distributionByOperationalNature: Record<OperationalNature, number>
}

export type KanbanOptions = {
  taskTypeId?: string
  departmentId?: string
  filters?: TaskListFilters
}

export type KanbanColumn = {
  step: WorkflowStep
  department: Department
  taskType: TaskType
  tasks: TaskSummary[]
}

export type KanbanDepartmentSection = {
  department: Department
  steps: Array<{
    step: WorkflowStep
    tasks: TaskSummary[]
  }>
}

export type KanbanBoard = {
  taskType: TaskType
  departments: KanbanDepartmentSection[]
  columns: KanbanColumn[]
}

export type KanbanData = {
  boards: KanbanBoard[]
  columns: KanbanColumn[]
  tasks: TaskSummary[]
}
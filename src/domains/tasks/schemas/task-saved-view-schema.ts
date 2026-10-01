import { z } from 'zod'

const nullableId = z.string().trim().min(1).nullish()
const optionalDate = z.iso.date().optional()

const taskSavedViewFiltersSchema = z.object({
  clientId: nullableId,
  departmentId: nullableId,
  projectId: nullableId,
  sprintId: nullableId,
  assigneeMemberId: nullableId,
  reviewerMemberId: nullableId,
  taskTypeId: nullableId,
  workflowStepId: nullableId,
  parentTaskId: nullableId,
  priority: z.enum(['low', 'medium', 'high']).optional(),
  state: z.enum(['active', 'completed', 'archived', 'all']).optional(),
  status: z.enum(['active', 'completed', 'archived', 'all']).optional(),
  completionState: z.enum(['all', 'completed', 'incomplete']).optional(),
  archiveState: z.enum(['all', 'archived', 'unarchived']).optional(),
  startDateFrom: optionalDate,
  startDateTo: optionalDate,
  dueDateFrom: optionalDate,
  dueDateTo: optionalDate,
  executionDateFrom: optionalDate,
  executionDateTo: optionalDate,
  publicationDateFrom: optionalDate,
  publicationDateTo: optionalDate,
  overdueOnly: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
  archivedOnly: z.boolean().optional(),
  includeCompleted: z.boolean().optional(),
  completedOnly: z.boolean().optional(),
  search: z.string().trim().max(500).optional(),
}).strict()

export const taskSavedViewSettingsSchema = z.object({
  filters: taskSavedViewFiltersSchema.optional(),
  sorting: z.array(z.object({
    field: z.enum(['task_number', 'title', 'priority', 'start_date', 'execution_date', 'due_date', 'publication_date', 'created_at']),
    direction: z.enum(['asc', 'desc']),
  }).strict()).max(4).optional(),
  grouping: z.enum([
    'none',
    'client',
    'project',
    'sprint',
    'assignee',
    'reviewer',
    'task_type',
    'department',
    'workflow_step',
    'priority',
  ]).optional(),
  colorMode: z.enum(['default', 'workflow', 'client', 'assignee', 'priority']).optional(),
  calendarDateMode: z.enum(['start_date', 'execution_date', 'due_date', 'publication_date']).optional(),
  calendarView: z.enum(['month', 'week', 'day']).optional(),
  state: z.enum(['active', 'completed', 'archived', 'all']).optional(),
  completionState: z.enum(['all', 'completed', 'incomplete']).optional(),
  archiveState: z.enum(['all', 'archived', 'unarchived']).optional(),
  includeCompleted: z.boolean().optional(),
  includeArchived: z.boolean().optional(),
}).strict()

export const taskSavedViewCreateSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da visualização.').max(120),
  view_type: z.enum(['dashboard', 'calendar', 'kanban', 'list']),
  settings: taskSavedViewSettingsSchema.default({}),
  is_default: z.boolean().default(false),
}).strict()

export const taskSavedViewUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da visualização.').max(120).optional(),
  settings: taskSavedViewSettingsSchema.optional(),
}).strict()
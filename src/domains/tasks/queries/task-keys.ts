import type { TaskListFilters } from '@/domains/tasks/types'

export const taskKeys = {
  all: ['tasks'] as const,
  workspace: (workspaceId: string | null) => [...taskKeys.all, workspaceId] as const,
  lists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'list'] as const,
  list: (workspaceId: string | null, filters: TaskListFilters = {}) =>
    [...taskKeys.lists(workspaceId), filters] as const,
  detail: (workspaceId: string | null, taskId: string | null) =>
    [...taskKeys.workspace(workspaceId), 'detail', taskId] as const,
  details: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'detail'] as const,
  projectLists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'project'] as const,
  projects: (workspaceId: string | null) => taskKeys.projectLists(workspaceId),
  project: (workspaceId: string | null, projectId: string | null, filters: TaskListFilters = {}) =>
    [...taskKeys.projects(workspaceId), projectId, filters] as const,
  assigneeLists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'assignee'] as const,
  assignees: (workspaceId: string | null) => taskKeys.assigneeLists(workspaceId),
  assignee: (workspaceId: string | null, memberId: string | null, filters: TaskListFilters = {}) =>
    [...taskKeys.assignees(workspaceId), memberId, filters] as const,
  reviewerLists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'reviewer'] as const,
  reviewers: (workspaceId: string | null) => taskKeys.reviewerLists(workspaceId),
  reviewer: (workspaceId: string | null, memberId: string | null, filters: TaskListFilters = {}) =>
    [...taskKeys.reviewers(workspaceId), memberId, filters] as const,
  taskTypeLists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'task-type'] as const,
  taskTypes: (workspaceId: string | null) => taskKeys.taskTypeLists(workspaceId),
  taskType: (workspaceId: string | null, taskTypeId: string | null, filters: TaskListFilters = {}) =>
    [...taskKeys.taskTypes(workspaceId), taskTypeId, filters] as const,
  workflowStepLists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'workflow-step'] as const,
  workflowSteps: (workspaceId: string | null) => taskKeys.workflowStepLists(workspaceId),
  workflowStep: (workspaceId: string | null, workflowStepId: string | null, filters: TaskListFilters = {}) =>
    [...taskKeys.workflowSteps(workspaceId), workflowStepId, filters] as const,
  overdue: (workspaceId: string | null, asOf: string) =>
    [...taskKeys.workspace(workspaceId), 'overdue', asOf] as const,
  overdueLists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'overdue'] as const,
  archived: (workspaceId: string | null, filters: TaskListFilters = {}) =>
    [...taskKeys.workspace(workspaceId), 'archived', filters] as const,
  archivedLists: (workspaceId: string | null) => [...taskKeys.workspace(workspaceId), 'archived'] as const,
  subtaskLists: (workspaceId: string | null, parentTaskId?: string | null) =>
    parentTaskId
      ? [...taskKeys.workspace(workspaceId), 'subtasks', parentTaskId] as const
      : [...taskKeys.workspace(workspaceId), 'subtasks'] as const,
  subtasks: (workspaceId: string | null, parentTaskId: string | null, includeArchived = false) =>
    [...taskKeys.workspace(workspaceId), 'subtasks', parentTaskId, includeArchived] as const,
  parent: (workspaceId: string | null, taskId: string | null) =>
    [...taskKeys.workspace(workspaceId), 'parent', taskId] as const,
  activity: (workspaceId: string | null, taskId: string | null) =>
    [...taskKeys.workspace(workspaceId), 'activity', taskId] as const,
}
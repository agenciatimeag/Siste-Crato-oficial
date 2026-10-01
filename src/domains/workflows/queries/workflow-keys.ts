export const workflowKeys = {
  all: ['workflows'] as const,
  taskTypeLists: (workspaceId: string | null) =>
    [...workflowKeys.all, 'task-types', workspaceId] as const,
  taskTypes: (workspaceId: string | null, activeOnly = false) =>
    [...workflowKeys.all, 'task-types', workspaceId, activeOnly] as const,
  taskType: (workspaceId: string | null, taskTypeId: string | null) =>
    [...workflowKeys.all, 'task-type', workspaceId, taskTypeId] as const,
  departments: (workspaceId: string | null, activeOnly = false) =>
    [...workflowKeys.all, 'departments', workspaceId, activeOnly] as const,
  departmentLists: (workspaceId: string | null) =>
    [...workflowKeys.all, 'departments', workspaceId] as const,
  department: (workspaceId: string | null, departmentId: string | null) =>
    [...workflowKeys.all, 'department', workspaceId, departmentId] as const,
  flow: (workspaceId: string | null, taskTypeId: string | null, activeOnly = false) =>
    [...workflowKeys.all, 'flow', workspaceId, taskTypeId, activeOnly] as const,
  flows: (workspaceId: string | null, taskTypeId: string | null) =>
    [...workflowKeys.all, 'flow', workspaceId, taskTypeId] as const,
  firstDepartment: (workspaceId: string | null, taskTypeId: string | null) =>
    [...workflowKeys.all, 'first-department', workspaceId, taskTypeId] as const,
  firstStep: (workspaceId: string | null, taskTypeId: string | null) =>
    [...workflowKeys.all, 'first-step', workspaceId, taskTypeId] as const,
  taskTypeDepartments: (workspaceId: string | null, taskTypeId: string | null, activeOnly = false) =>
    [...workflowKeys.all, 'task-type-departments', workspaceId, taskTypeId, activeOnly] as const,
  taskTypeDepartmentLists: (workspaceId: string | null, taskTypeId: string | null) =>
    [...workflowKeys.all, 'task-type-departments', workspaceId, taskTypeId] as const,
  steps: (workspaceId: string | null, taskTypeDepartmentId: string | null, activeOnly = false) =>
    [...workflowKeys.all, 'steps', workspaceId, taskTypeDepartmentId, activeOnly] as const,
  stepLists: (workspaceId: string | null, taskTypeDepartmentId: string | null) =>
    [...workflowKeys.all, 'steps', workspaceId, taskTypeDepartmentId] as const,
  step: (workspaceId: string | null, workflowStepId: string | null) =>
    [...workflowKeys.all, 'step', workspaceId, workflowStepId] as const,
}
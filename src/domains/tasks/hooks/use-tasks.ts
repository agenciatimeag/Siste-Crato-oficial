import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '@/domains/workspaces/workspace-context'
import { taskKeys } from '@/domains/tasks/queries/task-keys'
import type { Task, TaskCreateInput, TaskListFilters, TaskSubtaskInput, TaskUpdateInput } from '@/domains/tasks/types'
import {
  getParentTask,
  getTaskDetails,
  listArchivedTasks,
  listOverdueTasks,
  listSubtasks,
  listTaskActivity,
  listTasks,
  listTasksByAssignee,
  listTasksByProject,
  listTasksByReviewer,
  listTasksByType,
  listTasksByWorkflowStep,
} from '@/domains/tasks/queries/task-queries'
import {
  archiveTask,
  assignTask,
  changeTaskType,
  createSubtask,
  createTask,
  moveTaskToDepartment,
  moveTaskToStep,
  reorderTasksInProject,
  restoreTask,
  setTaskReviewer,
  setTaskSortOrder,
  updateTask,
} from '@/domains/tasks/mutations/task-mutations'

function isWorkspaceReady(status: string, workspaceId: string | null) {
  return status === 'ready' && Boolean(workspaceId)
}

function useTaskInvalidation() {
  const queryClient = useQueryClient()
  const { workspace } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  const listPrefixes = workspaceId ? [
    taskKeys.lists(workspaceId),
    taskKeys.projectLists(workspaceId),
    taskKeys.assigneeLists(workspaceId),
    taskKeys.reviewerLists(workspaceId),
    taskKeys.taskTypeLists(workspaceId),
    taskKeys.workflowStepLists(workspaceId),
    taskKeys.overdueLists(workspaceId),
    taskKeys.archivedLists(workspaceId),
  ] : []
  const invalidateTaskLists = () => Promise.all(
    listPrefixes.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
  return {
    invalidateTaskLists,
    invalidateTask: (task: Pick<Task, 'id' | 'parent_task_id'>) => workspaceId
      ? Promise.all([
        invalidateTaskLists(),
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(workspaceId, task.id) }),
        queryClient.invalidateQueries({ queryKey: taskKeys.activity(workspaceId, task.id) }),
        ...(task.parent_task_id
          ? [queryClient.invalidateQueries({ queryKey: taskKeys.subtaskLists(workspaceId, task.parent_task_id) })]
          : []),
      ])
      : Promise.resolve(),
    invalidateSubtasks: (parentTaskId: string) => workspaceId
      ? queryClient.invalidateQueries({ queryKey: taskKeys.subtaskLists(workspaceId, parentTaskId) })
      : Promise.resolve(),
    invalidateTasks: (tasks: Task[]) => Promise.all([
      invalidateTaskLists(),
      ...tasks.flatMap((task) => [
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(workspaceId, task.id) }),
        queryClient.invalidateQueries({ queryKey: taskKeys.activity(workspaceId, task.id) }),
        ...(task.parent_task_id
          ? [queryClient.invalidateQueries({ queryKey: taskKeys.subtaskLists(workspaceId, task.parent_task_id) })]
          : []),
      ]),
    ]),
  }
}

export function useTasks(filters: TaskListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.list(workspaceId, filters),
    queryFn: () => listTasks(workspace!.id, filters),
    enabled: isWorkspaceReady(status, workspaceId),
  })
}

export function useProjectTasks(projectId: string | null, filters: TaskListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.project(workspaceId, projectId, filters),
    queryFn: () => listTasksByProject(workspace!.id, projectId!, filters),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(projectId),
  })
}

export function useAssigneeTasks(memberId: string | null, filters: TaskListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.assignee(workspaceId, memberId, filters),
    queryFn: () => listTasksByAssignee(workspace!.id, memberId!, filters),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(memberId),
  })
}

export function useReviewerTasks(memberId: string | null, filters: TaskListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.reviewer(workspaceId, memberId, filters),
    queryFn: () => listTasksByReviewer(workspace!.id, memberId!, filters),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(memberId),
  })
}

export function useTaskTypeTasks(taskTypeId: string | null, filters: TaskListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.taskType(workspaceId, taskTypeId, filters),
    queryFn: () => listTasksByType(workspace!.id, taskTypeId!, filters),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(taskTypeId),
  })
}

export function useWorkflowStepTasks(workflowStepId: string | null, filters: TaskListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.workflowStep(workspaceId, workflowStepId, filters),
    queryFn: () => listTasksByWorkflowStep(workspace!.id, workflowStepId!, filters),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(workflowStepId),
  })
}

export function useOverdueTasks(asOf = new Date().toISOString().slice(0, 10)) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.overdue(workspaceId, asOf),
    queryFn: () => listOverdueTasks(workspace!.id, asOf),
    enabled: isWorkspaceReady(status, workspaceId),
  })
}

export function useArchivedTasks(filters: TaskListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.archived(workspaceId, filters),
    queryFn: () => listArchivedTasks(workspace!.id, filters),
    enabled: isWorkspaceReady(status, workspaceId),
  })
}

export function useTaskDetails(taskId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.detail(workspaceId, taskId),
    queryFn: () => getTaskDetails(workspace!.id, taskId!),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(taskId),
  })
}

export function useTaskParent(taskId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.parent(workspaceId, taskId),
    queryFn: () => getParentTask(workspace!.id, taskId!),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(taskId),
  })
}

export function useSubtasks(parentTaskId: string | null, includeArchived = false) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.subtasks(workspaceId, parentTaskId, includeArchived),
    queryFn: () => listSubtasks(workspace!.id, parentTaskId!, { includeArchived }),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(parentTaskId),
  })
}

export function useTaskActivity(taskId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: taskKeys.activity(workspaceId, taskId),
    queryFn: () => listTaskActivity(workspace!.id, taskId!),
    enabled: isWorkspaceReady(status, workspaceId) && Boolean(taskId),
  })
}

export function useCreateTask() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: (input: TaskCreateInput) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createTask(workspace.id, input, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useCreateSubtask() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ parentTaskId, input }: { parentTaskId: string; input: TaskSubtaskInput }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createSubtask(workspace.id, parentTaskId, input, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useUpdateTask() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ taskId, values }: { taskId: string; values: TaskUpdateInput }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateTask(workspace.id, taskId, values, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useMoveTaskToStep() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ taskId, workflowStepId }: { taskId: string; workflowStepId: string }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return moveTaskToStep(workspace.id, taskId, workflowStepId, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useMoveTaskToDepartment() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ taskId, departmentId, workflowStepId }: { taskId: string; departmentId: string; workflowStepId?: string }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return moveTaskToDepartment(workspace.id, taskId, departmentId, workflowStepId, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useChangeTaskType() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ taskId, taskTypeId }: { taskId: string; taskTypeId: string }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return changeTaskType(workspace.id, taskId, taskTypeId, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useAssignTask() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ taskId, memberId }: { taskId: string; memberId: string | null }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return assignTask(workspace.id, taskId, memberId, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useSetTaskReviewer() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ taskId, memberId }: { taskId: string; memberId: string | null }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return setTaskReviewer(workspace.id, taskId, memberId, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useArchiveTask() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: (taskId: string) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return archiveTask(workspace.id, taskId, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useRestoreTask() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: (taskId: string) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return restoreTask(workspace.id, taskId, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useSetTaskSortOrder() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ taskId, sortOrder }: { taskId: string; sortOrder: number }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return setTaskSortOrder(workspace.id, taskId, sortOrder, workspace.memberId)
    },
    onSuccess: (task) => invalidation.invalidateTask(task),
  })
}

export function useReorderTasksInProject() {
  const { workspace, status } = useWorkspace()
  const invalidation = useTaskInvalidation()
  return useMutation({
    mutationFn: ({ projectId, orderedTaskIds }: { projectId: string; orderedTaskIds: string[] }) => {
      if (!isWorkspaceReady(status, workspace?.id ?? null) || !workspace) throw new Error('O workspace ainda não está disponível.')
      return reorderTasksInProject(workspace.id, projectId, orderedTaskIds, workspace.memberId)
    },
    onSuccess: (tasks) => invalidation.invalidateTasks(tasks),
  })
}
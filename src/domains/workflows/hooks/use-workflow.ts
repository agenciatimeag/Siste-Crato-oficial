import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '@/domains/workspaces/workspace-context'
import { workflowKeys } from '@/domains/workflows/queries/workflow-keys'
import { getDepartment, getTaskType, listDepartments, listTaskTypes } from '@/domains/workflows/queries/catalog-queries'
import { getDepartmentsForTaskType, getFirstDepartment, getFirstStep, getFirstStepForDepartment, getStepsForDepartment, getWorkflowForTaskType, getWorkflowStep, listWorkflowSteps, resolveDepartmentChange, resolveTaskTypeChange, resolveWorkflowPosition, validateWorkflowPosition } from '@/domains/workflows/queries/workflow-queries'
import { createDepartment, createTaskType, setDepartmentActive, setTaskTypeActive, updateDepartment, updateTaskType } from '@/domains/workflows/mutations/catalog-mutations'
import { addDepartmentToTaskType, createWorkflowStep, deactivateTaskTypeDepartment, moveTaskTypeDepartment, moveWorkflowStep, reorderTaskTypeDepartments, reorderWorkflowSteps, setWorkflowStepActive, updateTaskTypeDepartment, updateWorkflowStep } from '@/domains/workflows/mutations/workflow-mutations'
import type { TaskTypeInput } from '@/domains/workflows/types'
import type { WorkflowStepInput } from '@/domains/workflows/types'

function queryEnabled(status: string, workspaceId: string | null, id?: string | null) {
  return status === 'ready' && Boolean(workspaceId) && (id === undefined || Boolean(id))
}

export function useTaskTypes(activeOnly = false) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.taskTypes(workspaceId, activeOnly),
    queryFn: () => listTaskTypes(workspace!.id, { activeOnly }),
    enabled: queryEnabled(status, workspaceId),
  })
}

export function useTaskType(taskTypeId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.taskType(workspaceId, taskTypeId),
    queryFn: () => getTaskType(workspace!.id, taskTypeId!),
    enabled: queryEnabled(status, workspaceId, taskTypeId),
  })
}

export function useDepartments(activeOnly = false) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.departments(workspaceId, activeOnly),
    queryFn: () => listDepartments(workspace!.id, { activeOnly }),
    enabled: queryEnabled(status, workspaceId),
  })
}

export function useDepartment(departmentId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.department(workspaceId, departmentId),
    queryFn: () => getDepartment(workspace!.id, departmentId!),
    enabled: queryEnabled(status, workspaceId, departmentId),
  })
}

export function useWorkflowForTaskType(taskTypeId: string | null, activeOnly = false) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.flow(workspaceId, taskTypeId, activeOnly),
    queryFn: () => getWorkflowForTaskType(workspace!.id, taskTypeId!, { activeOnly }),
    enabled: queryEnabled(status, workspaceId, taskTypeId),
  })
}

export function useTaskTypeDepartments(taskTypeId: string | null, activeOnly = false) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.taskTypeDepartments(workspaceId, taskTypeId, activeOnly),
    queryFn: () => getDepartmentsForTaskType(workspace!.id, taskTypeId!, { activeOnly }),
    enabled: queryEnabled(status, workspaceId, taskTypeId),
  })
}

export function useWorkflowSteps(taskTypeDepartmentId: string | null, activeOnly = false) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.steps(workspaceId, taskTypeDepartmentId, activeOnly),
    queryFn: () => listWorkflowSteps(workspace!.id, taskTypeDepartmentId!, { activeOnly }),
    enabled: queryEnabled(status, workspaceId, taskTypeDepartmentId),
  })
}

export function useWorkflowStep(workflowStepId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.step(workspaceId, workflowStepId),
    queryFn: () => getWorkflowStep(workspace!.id, workflowStepId!),
    enabled: queryEnabled(status, workspaceId, workflowStepId),
  })
}

export function useFirstDepartment(taskTypeId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.firstDepartment(workspaceId, taskTypeId),
    queryFn: () => getFirstDepartment(workspace!.id, taskTypeId!),
    enabled: queryEnabled(status, workspaceId, taskTypeId),
  })
}

export function useFirstWorkflowStep(taskTypeId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: workflowKeys.firstStep(workspaceId, taskTypeId),
    queryFn: () => getFirstStep(workspace!.id, taskTypeId!),
    enabled: queryEnabled(status, workspaceId, taskTypeId),
  })
}

export function useWorkflowPositionResolver() {
  const { workspace, status } = useWorkspace()
  const getWorkspaceId = () => {
    if (status !== 'ready' || !workspace) {
      throw new Error('O workspace ainda não está disponível para resolver o workflow.')
    }
    return workspace.id
  }
  return {
    getFirstStepForDepartment: (taskTypeId: string, departmentId: string) =>
      getFirstStepForDepartment(getWorkspaceId(), taskTypeId, departmentId),
    getStepsForDepartment: (taskTypeId: string, departmentId: string, activeOnly = true) =>
      getStepsForDepartment(getWorkspaceId(), taskTypeId, departmentId, { activeOnly }),
    validateWorkflowPosition: (taskTypeId: string, workflowStepId: string) =>
      validateWorkflowPosition(getWorkspaceId(), taskTypeId, workflowStepId),
    resolveWorkflowPosition: (input: { taskTypeId: string; departmentId?: string; workflowStepId?: string }) =>
      resolveWorkflowPosition(getWorkspaceId(), input),
    resolveTaskTypeChange: (taskTypeId: string, currentWorkflowStepId: string | null) =>
      resolveTaskTypeChange(getWorkspaceId(), taskTypeId, currentWorkflowStepId),
    resolveDepartmentChange: (taskTypeId: string, departmentId: string, workflowStepId?: string) =>
      resolveDepartmentChange(getWorkspaceId(), taskTypeId, departmentId, workflowStepId),
  }
}

function useWorkflowInvalidation() {
  const { workspace } = useWorkspace()
  const queryClient = useQueryClient()
  const workspaceId = workspace?.id ?? null
  return {
    invalidateCatalog: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.taskTypeLists(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.departmentLists(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]),
    invalidateTaskType: (taskTypeId: string) => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.taskTypeLists(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.taskType(workspaceId, taskTypeId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.flows(workspaceId, taskTypeId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.taskTypeDepartmentLists(workspaceId, taskTypeId) }),
    ]),
    invalidateDepartment: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.departments(workspaceId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]),
  }
}

export function useCreateTaskType() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: (values: TaskTypeInput) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createTaskType(workspace.id, values)
    },
    onSuccess: () => invalidation.invalidateCatalog(),
  })
}

export function useUpdateTaskType() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ taskTypeId, values }: { taskTypeId: string; values: Partial<TaskTypeInput> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateTaskType(workspace.id, taskTypeId, values)
    },
    onSuccess: (taskType) => invalidation.invalidateTaskType(taskType.id),
  })
}

export function useSetTaskTypeActive() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ taskTypeId, isActive }: { taskTypeId: string; isActive: boolean }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return setTaskTypeActive(workspace.id, taskTypeId, isActive)
    },
    onSuccess: (taskType) => invalidation.invalidateTaskType(taskType.id),
  })
}

export function useCreateDepartment() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: (values: TaskTypeInput) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createDepartment(workspace.id, values)
    },
    onSuccess: () => invalidation.invalidateDepartment(),
  })
}

export function useUpdateDepartment() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ departmentId, values }: { departmentId: string; values: Partial<TaskTypeInput> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateDepartment(workspace.id, departmentId, values)
    },
    onSuccess: () => invalidation.invalidateDepartment(),
  })
}

export function useSetDepartmentActive() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ departmentId, isActive }: { departmentId: string; isActive: boolean }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return setDepartmentActive(workspace.id, departmentId, isActive)
    },
    onSuccess: () => invalidation.invalidateDepartment(),
  })
}

export function useAddDepartmentToTaskType() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ taskTypeId, values }: { taskTypeId: string; values: { department_id: string; position?: number; is_active?: boolean } }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return addDepartmentToTaskType(workspace.id, taskTypeId, values)
    },
    onSuccess: (_association, input) => invalidation.invalidateTaskType(input.taskTypeId),
  })
}

export function useUpdateTaskTypeDepartment() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ taskTypeId, associationId, isActive }: { taskTypeId: string; associationId: string; isActive: boolean }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateTaskTypeDepartment(workspace.id, taskTypeId, associationId, { is_active: isActive })
    },
    onSuccess: (_association, input) => invalidation.invalidateTaskType(input.taskTypeId),
  })
}

export function useDeactivateTaskTypeDepartment() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ taskTypeId, associationId }: { taskTypeId: string; associationId: string }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return deactivateTaskTypeDepartment(workspace.id, taskTypeId, associationId)
    },
    onSuccess: (_association, input) => invalidation.invalidateTaskType(input.taskTypeId),
  })
}

export function useMoveTaskTypeDepartment() {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: ({ taskTypeId, associationId, position }: { taskTypeId: string; associationId: string; position: number }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return moveTaskTypeDepartment(workspace.id, taskTypeId, associationId, position)
    },
    onSuccess: (_associations, input) => invalidation.invalidateTaskType(input.taskTypeId),
  })
}

export function useReorderTaskTypeDepartments(taskTypeId: string) {
  const { workspace, status } = useWorkspace()
  const invalidation = useWorkflowInvalidation()
  return useMutation({
    mutationFn: (orderedIds: string[]) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return reorderTaskTypeDepartments(workspace.id, taskTypeId, { orderedIds })
    },
    onSuccess: () => invalidation.invalidateTaskType(taskTypeId),
  })
}

export function useCreateWorkflowStep(taskTypeDepartmentId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: WorkflowStepInput) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createWorkflowStep(workspace.id, taskTypeDepartmentId, values)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.steps(workspace?.id ?? null, taskTypeDepartmentId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]),
  })
}

export function useUpdateWorkflowStep() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workflowStepId, values }: { workflowStepId: string; values: Partial<WorkflowStepInput> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateWorkflowStep(workspace.id, workflowStepId, values)
    },
    onSuccess: (step) => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.steps(workspace?.id ?? null, step.task_type_department_id) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.stepLists(workspace?.id ?? null, step.task_type_department_id) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.step(workspace?.id ?? null, step.id) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]),
  })
}

export function useSetWorkflowStepActive() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workflowStepId, isActive }: { workflowStepId: string; isActive: boolean }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return setWorkflowStepActive(workspace.id, workflowStepId, isActive)
    },
    onSuccess: (step) => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.steps(workspace?.id ?? null, step.task_type_department_id) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.stepLists(workspace?.id ?? null, step.task_type_department_id) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.step(workspace?.id ?? null, step.id) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]),
  })
}

export function useMoveWorkflowStep(taskTypeDepartmentId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ workflowStepId, position }: { workflowStepId: string; position: number }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return moveWorkflowStep(workspace.id, taskTypeDepartmentId, workflowStepId, position)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.steps(workspace?.id ?? null, taskTypeDepartmentId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.stepLists(workspace?.id ?? null, taskTypeDepartmentId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]),
  })
}

export function useReorderWorkflowSteps(taskTypeDepartmentId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return reorderWorkflowSteps(workspace.id, taskTypeDepartmentId, { orderedIds })
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: workflowKeys.steps(workspace?.id ?? null, taskTypeDepartmentId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.stepLists(workspace?.id ?? null, taskTypeDepartmentId) }),
      queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
    ]),
  })
}
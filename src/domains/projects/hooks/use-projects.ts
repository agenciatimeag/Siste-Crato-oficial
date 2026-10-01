import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '@/domains/workspaces/workspace-context'
import { activityKeys } from '@/domains/activity/activity-keys'
import { clientKeys } from '@/domains/clients/queries/client-keys'
import { projectKeys } from '@/domains/projects/queries/project-keys'
import type { ProjectInput } from '@/domains/projects/types'
import { getProject, listClientProjects, listProjectFiles, listProjectSquad } from '@/domains/projects/queries/project-queries'
import { addProjectMember, changeProjectStatus, createProject, removeProjectMember, updateProject, updateProjectMember } from '@/domains/projects/mutations/project-mutations'
import type { ProjectMemberInput } from '@/domains/projects/types'

export function useClientProjects(clientId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: clientKeys.projects(workspaceId, clientId),
    queryFn: () => listClientProjects(workspace!.id, clientId!),
    enabled: status === 'ready' && Boolean(workspaceId && clientId),
  })
}

export function useProject(projectId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: projectKeys.detail(workspaceId, projectId),
    queryFn: () => getProject(workspace!.id, projectId!),
    enabled: status === 'ready' && Boolean(workspaceId && projectId),
  })
}

export function useProjectSquad(projectId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: projectKeys.squad(workspaceId, projectId),
    queryFn: () => listProjectSquad(workspace!.id, projectId!),
    enabled: status === 'ready' && Boolean(workspaceId && projectId),
  })
}

export function useProjectFiles(projectId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: projectKeys.files(workspaceId, projectId),
    queryFn: () => listProjectFiles(workspace!.id, projectId!),
    enabled: status === 'ready' && Boolean(workspaceId && projectId),
  })
}

export function useCreateProject() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProjectInput) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createProject(workspace.id, values, workspace.memberId)
    },
    onSuccess: (project) => Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.list(workspace?.id ?? null, project.client_id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.projects(workspace?.id ?? null, project.client_id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, project.client_id) }),
    ]),
  })
}

export function useUpdateProject() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, values }: { projectId: string; values: Partial<ProjectInput> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateProject(workspace.id, projectId, values, workspace.memberId)
    },
    onSuccess: (project) => Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspace?.id ?? null, project.id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.projects(workspace?.id ?? null, project.client_id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(workspace?.id ?? null) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'project', project.id) }),
    ]),
  })
}

export function useChangeProjectStatus() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, status: nextStatus }: { projectId: string; status: 'active' | 'paused' | 'completed' }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return changeProjectStatus(workspace.id, projectId, nextStatus, workspace.memberId)
    },
    onSuccess: (project) => Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(workspace?.id ?? null, project.id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(workspace?.id ?? null) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'project', project.id) }),
    ]),
  })
}

export function useAddProjectMember(projectId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ProjectMemberInput) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return addProjectMember(workspace.id, projectId, values, workspace.memberId)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.squad(workspace?.id ?? null, projectId) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'project', projectId) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(workspace?.id ?? null) }),
    ]),
  })
}

export function useUpdateProjectMember(projectId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ memberId, values }: { memberId: string; values: Pick<ProjectMemberInput, 'role_label' | 'is_lead'> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateProjectMember(workspace.id, projectId, memberId, values, workspace.memberId)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.squad(workspace?.id ?? null, projectId) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'project', projectId) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(workspace?.id ?? null) }),
    ]),
  })
}

export function useRemoveProjectMember(projectId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (memberId: string) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return removeProjectMember(workspace.id, projectId, memberId, workspace.memberId)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: projectKeys.squad(workspace?.id ?? null, projectId) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'project', projectId) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(workspace?.id ?? null) }),
    ]),
  })
}
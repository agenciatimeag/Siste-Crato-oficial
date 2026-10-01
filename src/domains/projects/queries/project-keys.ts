export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (workspaceId: string | null, clientId: string | null) =>
    [...projectKeys.lists(), workspaceId, clientId] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (workspaceId: string | null, projectId: string | null) =>
    [...projectKeys.details(), workspaceId, projectId] as const,
  squad: (workspaceId: string | null, projectId: string | null) =>
    [...projectKeys.all, 'squad', workspaceId, projectId] as const,
  files: (workspaceId: string | null, projectId: string | null) =>
    [...projectKeys.all, 'files', workspaceId, projectId] as const,
}
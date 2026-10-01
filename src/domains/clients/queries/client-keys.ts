import type { ClientListFilters } from '@/domains/clients/types'

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (workspaceId: string | null, filters: ClientListFilters = {}) =>
    [...clientKeys.lists(), workspaceId, filters] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (workspaceId: string | null, clientId: string | null) =>
    [...clientKeys.details(), workspaceId, clientId] as const,
  contacts: (workspaceId: string | null, clientId: string | null) =>
    [...clientKeys.all, 'contacts', workspaceId, clientId] as const,
  contracts: (workspaceId: string | null, clientId: string | null) =>
    [...clientKeys.all, 'contracts', workspaceId, clientId] as const,
  projects: (workspaceId: string | null, clientId: string | null) =>
    [...clientKeys.all, 'projects', workspaceId, clientId] as const,
  activity: (workspaceId: string | null, clientId: string | null) =>
    [...clientKeys.all, 'activity', workspaceId, clientId] as const,
  activities: (workspaceId: string | null) =>
    [...clientKeys.all, 'activity', workspaceId] as const,
}
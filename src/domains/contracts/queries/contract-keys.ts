export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (workspaceId: string | null, clientId: string | null) =>
    [...contractKeys.lists(), workspaceId, clientId] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (workspaceId: string | null, contractId: string | null) =>
    [...contractKeys.details(), workspaceId, contractId] as const,
  templates: (workspaceId: string | null, activeOnly = true) =>
    [...contractKeys.all, 'templates', workspaceId, activeOnly] as const,
  billingTerms: (workspaceId: string | null, contractId: string | null) =>
    [...contractKeys.all, 'billing-terms', workspaceId, contractId] as const,
}
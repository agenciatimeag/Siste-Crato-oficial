export const activityKeys = {
  all: ['activity'] as const,
  entity: (workspaceId: string | null, entityType: string, entityId: string | null) =>
    [...activityKeys.all, workspaceId, entityType, entityId] as const,
}
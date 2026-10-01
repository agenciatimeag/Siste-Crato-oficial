import { useQuery } from '@tanstack/react-query'
import { clientKeys } from '@/domains/clients/queries/client-keys'
import { listClientActivity } from '@/domains/clients/queries/client-queries'
import { useWorkspace } from '@/domains/workspaces/workspace-context'

export function useClientActivity(clientId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: clientKeys.activity(workspaceId, clientId),
    queryFn: () => listClientActivity(workspace!.id, clientId!),
    enabled: status === 'ready' && Boolean(workspaceId && clientId),
  })
}
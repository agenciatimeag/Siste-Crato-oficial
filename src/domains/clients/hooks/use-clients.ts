import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '@/domains/workspaces/workspace-context'
import type { ClientListFilters } from '@/domains/clients/types'
import type { ClientInput } from '@/domains/clients/schemas/client-schema'
import type { ContactInput } from '@/domains/clients/schemas/contact-schema'
import { listClients, getClient, listClientContacts } from '@/domains/clients/queries/client-queries'
import { changeClientStatus, createClient, updateClient, createClientContact, removeClientContact, setPrimaryContact, updateClientContact } from '@/domains/clients/mutations/client-mutations'
import { clientKeys } from '@/domains/clients/queries/client-keys'

export function useClients(filters: ClientListFilters = {}) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: clientKeys.list(workspaceId, filters),
    queryFn: () => listClients(workspace!.id, filters),
    enabled: status === 'ready' && Boolean(workspaceId),
  })
}

export function useClient(clientId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: clientKeys.detail(workspaceId, clientId),
    queryFn: () => getClient(workspace!.id, clientId!),
    enabled: status === 'ready' && Boolean(workspaceId && clientId),
  })
}

export function useClientContacts(clientId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: clientKeys.contacts(workspaceId, clientId),
    queryFn: () => listClientContacts(workspace!.id, clientId!),
    enabled: status === 'ready' && Boolean(workspaceId && clientId),
  })
}

export function useCreateClient() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ClientInput) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createClient(workspace.id, values, workspace.memberId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientKeys.lists() }),
  })
}

export function useUpdateClient() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, values }: { clientId: string; values: Partial<ClientInput> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateClient(workspace.id, clientId, values, workspace.memberId)
    },
    onSuccess: (client) => Promise.all([
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(workspace?.id ?? null, client.id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, client.id) }),
    ]),
  })
}

export function useChangeClientStatus() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, status: nextStatus }: { clientId: string; status: 'active' | 'paused' | 'inactive' }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return changeClientStatus(workspace.id, clientId, nextStatus, workspace.memberId)
    },
    onSuccess: (client) => Promise.all([
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(workspace?.id ?? null, client.id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, client.id) }),
    ]),
  })
}

export function useCreateClientContact(clientId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ContactInput) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createClientContact(workspace.id, clientId, values, workspace.memberId)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: clientKeys.contacts(workspace?.id ?? null, clientId) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, clientId) }),
    ]),
  })
}

export function useUpdateClientContact(clientId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, values }: { contactId: string; values: Partial<ContactInput> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateClientContact(workspace.id, clientId, contactId, values, workspace.memberId)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: clientKeys.contacts(workspace?.id ?? null, clientId) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, clientId) }),
    ]),
  })
}

export function useSetPrimaryContact(clientId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return setPrimaryContact(workspace.id, clientId, contactId, workspace.memberId)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: clientKeys.contacts(workspace?.id ?? null, clientId) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, clientId) }),
    ]),
  })
}

export function useRemoveClientContact(clientId: string) {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contactId: string) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return removeClientContact(workspace.id, clientId, contactId, workspace.memberId)
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: clientKeys.contacts(workspace?.id ?? null, clientId) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, clientId) }),
    ]),
  })
}
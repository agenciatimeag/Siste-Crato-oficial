import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWorkspace } from '@/domains/workspaces/workspace-context'
import { activityKeys } from '@/domains/activity/activity-keys'
import { clientKeys } from '@/domains/clients/queries/client-keys'
import { contractKeys } from '@/domains/contracts/queries/contract-keys'
import type { BillingTermsInput, ContractInput, ContractStatus } from '@/domains/contracts/types'
import { getContract, getContractBillingTerms, getContractTemplate, listClientContracts, listContractTemplates } from '@/domains/contracts/queries/contract-queries'
import { changeContractStatus, createContract, saveContractBillingTerms, updateContract } from '@/domains/contracts/mutations/contract-mutations'

export function useClientContracts(clientId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: contractKeys.list(workspaceId, clientId),
    queryFn: () => listClientContracts(workspace!.id, clientId!),
    enabled: status === 'ready' && Boolean(workspaceId && clientId),
  })
}

export function useContract(contractId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: contractKeys.detail(workspaceId, contractId),
    queryFn: () => getContract(workspace!.id, contractId!),
    enabled: status === 'ready' && Boolean(workspaceId && contractId),
  })
}

export function useContractTemplates(activeOnly = true) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: contractKeys.templates(workspaceId, activeOnly),
    queryFn: () => listContractTemplates(workspace!.id, activeOnly),
    enabled: status === 'ready' && Boolean(workspaceId),
  })
}

export function useContractTemplate(templateId: string | null, activeOnly = true) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: [...contractKeys.templates(workspaceId, activeOnly), templateId],
    queryFn: () => getContractTemplate(workspace!.id, templateId!, activeOnly),
    enabled: status === 'ready' && Boolean(workspaceId && templateId),
  })
}

export function useContractBillingTerms(contractId: string | null) {
  const { workspace, status } = useWorkspace()
  const workspaceId = workspace?.id ?? null
  return useQuery({
    queryKey: contractKeys.billingTerms(workspaceId, contractId),
    queryFn: () => getContractBillingTerms(workspace!.id, contractId!),
    enabled: status === 'ready' && Boolean(workspaceId && contractId),
  })
}

export function useCreateContract() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, values }: { clientId: string; values: ContractInput }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return createContract(workspace.id, clientId, values, workspace.memberId)
    },
    onSuccess: (contract) => Promise.all([
      queryClient.invalidateQueries({ queryKey: contractKeys.list(workspace?.id ?? null, contract.client_id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.contracts(workspace?.id ?? null, contract.client_id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, contract.client_id) }),
    ]),
  })
}

export function useUpdateContract() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contractId, values }: { contractId: string; values: Partial<ContractInput> }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return updateContract(workspace.id, contractId, values, workspace.memberId)
    },
    onSuccess: (contract) => Promise.all([
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(workspace?.id ?? null, contract.id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.contracts(workspace?.id ?? null, contract.client_id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, contract.client_id) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'contract', contract.id) }),
    ]),
  })
}

export function useChangeContractStatus() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contractId, status: nextStatus }: { contractId: string; status: ContractStatus }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return changeContractStatus(workspace.id, contractId, nextStatus, workspace.memberId)
    },
    onSuccess: (contract) => Promise.all([
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() }),
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(workspace?.id ?? null, contract.id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activity(workspace?.id ?? null, contract.client_id) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'contract', contract.id) }),
    ]),
  })
}

export function useSaveContractBillingTerms() {
  const { workspace, status } = useWorkspace()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ contractId, values }: { contractId: string; values: BillingTermsInput }) => {
      if (status !== 'ready' || !workspace) throw new Error('O workspace ainda não está disponível.')
      return saveContractBillingTerms(workspace.id, contractId, values, workspace.memberId)
    },
    onSuccess: (terms) => Promise.all([
      queryClient.invalidateQueries({ queryKey: contractKeys.billingTerms(workspace?.id ?? null, terms.contract_id) }),
      queryClient.invalidateQueries({ queryKey: clientKeys.activities(workspace?.id ?? null) }),
      queryClient.invalidateQueries({ queryKey: activityKeys.entity(workspace?.id ?? null, 'contract', terms.contract_id) }),
    ]),
  })
}
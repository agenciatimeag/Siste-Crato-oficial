import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { recordActivity } from '@/domains/activity/activity-service'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import type { BillingTermsInput, Contract, ContractInput, ContractTemplate } from '@/domains/contracts/types'
import { billingTermsSchema } from '@/domains/contracts/schemas/billing-terms-schema'
import { contractSchema, contractStatusSchema } from '@/domains/contracts/schemas/contract-schema'
import { toBillingTermsInsert } from '@/domains/contracts/billing-mapper'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

async function ensureClient(workspaceId: string, clientId: string, client: SupabaseClient<Database>) {
  const { data, error } = await client.from('clients').select('id')
    .eq('workspace_id', workspaceId).eq('id', clientId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Cliente não encontrado neste workspace.', 'CLIENT_NOT_FOUND')
}

export async function getContractTemplate(
  workspaceId: string,
  templateId: string,
  activeOnly = true,
  client: SupabaseClient<Database> = supabase,
): Promise<ContractTemplate> {
  requireWorkspace(workspaceId)
  let query = client.from('contract_templates').select('*')
    .eq('workspace_id', workspaceId).eq('id', templateId)
  if (activeOnly) query = query.eq('status', 'active')
  const { data, error } = await query.maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Modelo de contrato não encontrado neste workspace.', 'CONTRACT_TEMPLATE_NOT_FOUND')
  return data
}

export async function listContractTemplates(
  workspaceId: string,
  activeOnly = true,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  let query = client.from('contract_templates').select('*').eq('workspace_id', workspaceId)
  if (activeOnly) query = query.eq('status', 'active')
  const { data, error } = await query.order('name')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function listClientContracts(
  workspaceId: string,
  clientId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Contract[]> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('contracts').select('*')
    .eq('workspace_id', workspaceId).eq('client_id', clientId).order('created_at', { ascending: false })
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function getContract(
  workspaceId: string,
  contractId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Contract> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('contracts').select('*')
    .eq('workspace_id', workspaceId).eq('id', contractId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Contrato não encontrado neste workspace.', 'CONTRACT_NOT_FOUND')
  return data
}

async function contractPayload(
  workspaceId: string,
  values: ContractInput,
  client: SupabaseClient<Database>,
  existing?: Contract,
) {
  let bodyJson: unknown = values.body_json ?? existing?.body_json ?? {}
  let bodyText = values.body_text ?? existing?.body_text ?? null
  if (values.source_type === 'template') {
    if (!values.template_id) throw new DomainError('Selecione um modelo para este contrato.', 'CONTRACT_TEMPLATE_REQUIRED')
    if (existing?.source_type === 'template' && existing.template_id === values.template_id) {
      bodyJson = values.body_json ?? existing.body_json
      bodyText = values.body_text ?? existing.body_text
    } else {
      const template = await getContractTemplate(workspaceId, values.template_id, true, client)
      bodyJson = template.body_json
      bodyText = template.body_text
    }
  }

  return {
    template_id: values.source_type === 'template' ? values.template_id ?? null : null,
    title: values.title.trim(),
    code: values.code?.trim() || null,
    source_type: values.source_type,
    status: values.status ?? 'draft',
    body_json: bodyJson,
    body_text: bodyText,
    start_date: values.start_date ?? null,
    end_date: values.end_date ?? null,
    signed_at: values.signed_at ?? null,
    notes: values.notes?.trim() || null,
  }
}

export async function createContract(
  workspaceId: string,
  clientId: string,
  values: ContractInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Contract> {
  requireWorkspace(workspaceId)
  await ensureClient(workspaceId, clientId, client)
  const parsedValues = contractSchema.parse(values)
  const payload = await contractPayload(workspaceId, parsedValues, client)
  const { data, error } = await client.from('contracts').insert({
    ...payload,
    workspace_id: workspaceId,
    client_id: clientId,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar o contrato.', 'CONTRACT_CREATE_FAILED')

  await recordActivity({
    workspaceId,
    entityType: 'contract',
    entityId: data.id,
    action: 'contract.created',
    actorMemberId,
    metadata: { client_id: clientId, title: data.title, source_type: data.source_type },
  }, client)
  return data
}

export async function updateContract(
  workspaceId: string,
  contractId: string,
  values: Partial<ContractInput>,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Contract> {
  const current = await getContract(workspaceId, contractId, client)
  const parsedValues = contractSchema.parse({ ...current, ...values })
  const payload = await contractPayload(workspaceId, parsedValues, client, current)
  const hasChanges = Object.entries(payload).some(([field, value]) =>
    JSON.stringify(current[field as keyof Contract]) !== JSON.stringify(value),
  )
  if (!hasChanges) return current
  const { data, error } = await client.from('contracts').update(payload)
    .eq('workspace_id', workspaceId).eq('id', contractId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Contrato não encontrado neste workspace.', 'CONTRACT_NOT_FOUND')

  await recordActivity({
    workspaceId,
    entityType: 'contract',
    entityId: data.id,
    action: 'contract.updated',
    actorMemberId,
    metadata: { client_id: current.client_id, title: data.title },
  }, client)
  return data
}

export async function changeContractStatus(
  workspaceId: string,
  contractId: string,
  status: Contract['status'],
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const parsedStatus = contractStatusSchema.parse(status)
  const current = await getContract(workspaceId, contractId, client)
  if (current.status === parsedStatus) return current
  const { data, error } = await client.from('contracts').update({ status: parsedStatus })
    .eq('workspace_id', workspaceId).eq('id', contractId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Contrato não encontrado neste workspace.', 'CONTRACT_NOT_FOUND')
  await recordActivity({
    workspaceId,
    entityType: 'contract',
    entityId: data.id,
    action: 'contract.updated',
    actorMemberId,
    metadata: { previous_status: current.status, status: parsedStatus },
  }, client)
  return data
}

export async function getContractBillingTerms(
  workspaceId: string,
  contractId: string,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('contract_billing_terms').select('*')
    .eq('workspace_id', workspaceId).eq('contract_id', contractId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  return data
}

export async function saveContractBillingTerms(
  workspaceId: string,
  contractId: string,
  values: BillingTermsInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  await getContract(workspaceId, contractId, client)
  const parsedValues = billingTermsSchema.parse(values)
  const { data, error } = await client.from('contract_billing_terms')
    .upsert(toBillingTermsInsert(workspaceId, contractId, parsedValues), { onConflict: 'contract_id' })
    .select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível salvar as condições financeiras.', 'BILLING_TERMS_SAVE_FAILED')

  await recordActivity({
    workspaceId,
    entityType: 'contract',
    entityId: contractId,
    action: 'contract.updated',
    actorMemberId,
    metadata: { billing_terms_updated: true, billing_mode: parsedValues.mode },
  }, client)
  return data
}
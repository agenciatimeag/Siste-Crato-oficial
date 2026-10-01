import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { recordActivity } from '@/domains/activity/activity-service'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import type { Client, ClientListFilters } from '@/domains/clients/types'
import type { ClientInput } from '@/domains/clients/schemas/client-schema'
import { nullableTrimmed, normalizeCnpj, normalizeEmail, normalizePhone } from '@/domains/clients/formatters'
import { clientSchema, clientStatusSchema } from '@/domains/clients/schemas/client-schema'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

function clientPayload(values: ClientInput) {
  return {
    display_name: values.display_name.trim(),
    legal_name: nullableTrimmed(values.legal_name),
    trade_name: nullableTrimmed(values.trade_name),
    cnpj: normalizeCnpj(values.cnpj),
    phone: normalizePhone(values.phone),
    email: normalizeEmail(values.email),
    status: values.status ?? 'active',
    account_manager_member_id: values.account_manager_member_id ?? null,
    joined_on: values.joined_on ?? undefined,
    ended_on: values.ended_on ?? null,
    notes: nullableTrimmed(values.notes),
  }
}

export async function listClients(
  workspaceId: string,
  filters: ClientListFilters = {},
  client: SupabaseClient<Database> = supabase,
): Promise<Client[]> {
  requireWorkspace(workspaceId)
  let query = client.from('clients').select('*').eq('workspace_id', workspaceId).order('display_name')
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.search?.trim()) query = query.ilike('display_name', `%${filters.search.trim()}%`)
  const { data, error } = await query
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function getClient(
  workspaceId: string,
  clientId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<Client> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('clients').select('*')
    .eq('workspace_id', workspaceId).eq('id', clientId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Cliente não encontrado neste workspace.', 'CLIENT_NOT_FOUND')
  return data
}

export async function createClient(
  workspaceId: string,
  values: ClientInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Client> {
  requireWorkspace(workspaceId)
  const parsedValues = clientSchema.parse(values)
  const { data, error } = await client.from('clients').insert({
    ...clientPayload(parsedValues),
    workspace_id: workspaceId,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar o cliente.', 'CLIENT_CREATE_FAILED')

  await recordActivity({
    workspaceId,
    entityType: 'client',
    entityId: data.id,
    action: 'client.created',
    actorMemberId,
    metadata: { display_name: data.display_name },
  }, client)
  return data
}

export async function updateClient(
  workspaceId: string,
  clientId: string,
  values: Partial<ClientInput>,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<Client> {
  const current = await getClient(workspaceId, clientId, client)
  const parsedValues = clientSchema.parse({ ...current, ...values })
  const payload = clientPayload(parsedValues)
  const hasChanges = Object.entries(payload).some(([field, value]) =>
    value !== undefined && current[field as keyof Client] !== value,
  )
  if (!hasChanges) return current

  const { data, error } = await client.from('clients').update(payload)
    .eq('workspace_id', workspaceId).eq('id', clientId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Cliente não encontrado neste workspace.', 'CLIENT_NOT_FOUND')

  const statusChanged = current.status !== data.status
  await recordActivity({
    workspaceId,
    entityType: 'client',
    entityId: data.id,
    action: statusChanged ? 'client.status_changed' : 'client.updated',
    actorMemberId,
    metadata: statusChanged
      ? { previous_status: current.status, status: data.status }
      : { display_name: data.display_name },
  }, client)
  return data
}

export async function changeClientStatus(
  workspaceId: string,
  clientId: string,
  status: Client['status'],
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const parsedStatus = clientStatusSchema.parse(status)
  const current = await getClient(workspaceId, clientId, client)
  if (current.status === parsedStatus) return current
  const values = { ...current, status: parsedStatus } as ClientInput
  return updateClient(workspaceId, clientId, values, actorMemberId, client)
}
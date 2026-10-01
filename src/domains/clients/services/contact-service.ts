import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { recordActivity } from '@/domains/activity/activity-service'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import type { ClientContact } from '@/domains/clients/types'
import type { ContactInput } from '@/domains/clients/schemas/contact-schema'
import { nullableTrimmed, normalizeEmail, normalizePhone } from '@/domains/clients/formatters'
import { contactSchema } from '@/domains/clients/schemas/contact-schema'

function requireWorkspace(workspaceId: string) {
  if (!workspaceId.trim()) throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
}

async function ensureClient(workspaceId: string, clientId: string, client: SupabaseClient<Database>) {
  const { data, error } = await client.from('clients').select('id')
    .eq('workspace_id', workspaceId).eq('id', clientId).maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Cliente não encontrado neste workspace.', 'CLIENT_NOT_FOUND')
}

function contactPayload(values: ContactInput) {
  return {
    name: values.name.trim(),
    role_title: nullableTrimmed(values.role_title),
    phone: normalizePhone(values.phone),
    email: normalizeEmail(values.email),
    notes: nullableTrimmed(values.notes),
  }
}

async function makePrimary(
  workspaceId: string,
  clientId: string,
  contactId: string,
  db: SupabaseClient<Database>,
) {
  const { data: existingContact, error: contactLookupError } = await db.from('client_contacts').select('*')
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('id', contactId).maybeSingle()
  if (contactLookupError) throw mapDatabaseError(contactLookupError)
  if (!existingContact) throw new DomainError('Contato não encontrado neste cliente.', 'CONTACT_NOT_FOUND')

  const { data: previousPrimary, error: primaryLookupError } = await db.from('client_contacts').select('id')
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('is_primary', true).neq('id', contactId).maybeSingle()
  if (primaryLookupError) throw mapDatabaseError(primaryLookupError)
  if (existingContact.is_primary) return { contact: existingContact, changed: false, previousContactId: null }

  const { error: clearError } = await db.from('client_contacts').update({ is_primary: false })
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('is_primary', true).neq('id', contactId)
  if (clearError) throw mapDatabaseError(clearError)

  const { data, error } = await db.from('client_contacts').update({ is_primary: true })
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('id', contactId).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Contato não encontrado neste cliente.', 'CONTACT_NOT_FOUND')
  return { contact: data, changed: true, previousContactId: previousPrimary?.id ?? null }
}

export async function listClientContacts(
  workspaceId: string,
  clientId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<ClientContact[]> {
  requireWorkspace(workspaceId)
  const { data, error } = await client.from('client_contacts').select('*')
    .eq('workspace_id', workspaceId).eq('client_id', clientId)
    .order('is_primary', { ascending: false }).order('name')
  if (error) throw mapDatabaseError(error)
  return data ?? []
}

export async function createClientContact(
  workspaceId: string,
  clientId: string,
  values: ContactInput,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  await ensureClient(workspaceId, clientId, client)
  const parsedValues = contactSchema.parse(values)
  const { data: created, error } = await client.from('client_contacts').insert({
    ...contactPayload(parsedValues),
    workspace_id: workspaceId,
    client_id: clientId,
    is_primary: false,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!created) throw new DomainError('Não foi possível criar o contato.', 'CONTACT_CREATE_FAILED')

  const primaryChange = parsedValues.is_primary
    ? await makePrimary(workspaceId, clientId, created.id, client)
    : null
  const contact = primaryChange?.contact ?? created
  await recordActivity({
    workspaceId,
    entityType: 'client',
    entityId: clientId,
    action: 'contact.created',
    actorMemberId,
    metadata: {
      contact_id: contact.id,
      name: contact.name,
      is_primary: contact.is_primary,
      ...(primaryChange?.previousContactId ? { previous_primary_contact_id: primaryChange.previousContactId } : {}),
    },
  }, client)
  return contact
}

export async function updateClientContact(
  workspaceId: string,
  clientId: string,
  contactId: string,
  values: Partial<ContactInput>,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  await ensureClient(workspaceId, clientId, client)
  const { data: current, error: currentError } = await client.from('client_contacts').select('*')
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('id', contactId).maybeSingle()
  if (currentError) throw mapDatabaseError(currentError)
  if (!current) throw new DomainError('Contato não encontrado neste cliente.', 'CONTACT_NOT_FOUND')
  const parsedValues = contactSchema.parse({ ...current, ...values })
  const payload = contactPayload(parsedValues)
  const changedFields = Object.entries(payload)
    .filter(([field, value]) => current[field as keyof ClientContact] !== value)
    .map(([field]) => field)
  const primaryChanged = current.is_primary !== parsedValues.is_primary
  if (changedFields.length === 0 && !primaryChanged) return current

  if (changedFields.length > 0 || (primaryChanged && !parsedValues.is_primary)) {
    const { error: updateError } = await client.from('client_contacts').update({
      ...payload,
      ...(primaryChanged && !parsedValues.is_primary ? { is_primary: false } : {}),
    }).eq('workspace_id', workspaceId).eq('client_id', clientId).eq('id', contactId)
    if (updateError) throw mapDatabaseError(updateError)
  }

  const primaryChange = primaryChanged && parsedValues.is_primary
    ? await makePrimary(workspaceId, clientId, contactId, client)
    : null
  const { data: updated, error: updatedError } = await client.from('client_contacts').select('*')
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('id', contactId).single()
  if (updatedError) throw mapDatabaseError(updatedError)

  await recordActivity({
    workspaceId,
    entityType: 'client',
    entityId: clientId,
    action: primaryChanged ? 'contact.primary_changed' : 'contact.updated',
    actorMemberId,
    metadata: {
      contact_id: contactId,
      changed_fields: [...changedFields, ...(primaryChanged ? ['is_primary'] : [])],
      is_primary: updated.is_primary,
      ...(primaryChange?.previousContactId ? { previous_primary_contact_id: primaryChange.previousContactId } : {}),
    },
  }, client)
  return updated
}

export async function setPrimaryContact(
  workspaceId: string,
  clientId: string,
  contactId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  await ensureClient(workspaceId, clientId, client)
  const result = await makePrimary(workspaceId, clientId, contactId, client)
  if (result.changed) {
    await recordActivity({
      workspaceId,
      entityType: 'client',
      entityId: clientId,
      action: 'contact.primary_changed',
      actorMemberId,
      metadata: {
        contact_id: contactId,
        is_primary: true,
        ...(result.previousContactId ? { previous_primary_contact_id: result.previousContactId } : {}),
      },
    }, client)
  }
  return result.contact
}

export async function removeClientContact(
  workspaceId: string,
  clientId: string,
  contactId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  requireWorkspace(workspaceId)
  const { data: current, error: lookupError } = await client.from('client_contacts').select('id, name, is_primary')
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('id', contactId).maybeSingle()
  if (lookupError) throw mapDatabaseError(lookupError)
  if (!current) throw new DomainError('Contato não encontrado neste cliente.', 'CONTACT_NOT_FOUND')

  const { data, error } = await client.from('client_contacts').delete()
    .eq('workspace_id', workspaceId).eq('client_id', clientId).eq('id', contactId).select('id').maybeSingle()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Contato não encontrado neste cliente.', 'CONTACT_NOT_FOUND')
  await recordActivity({
    workspaceId,
    entityType: 'client',
    entityId: clientId,
    action: 'contact.deleted',
    actorMemberId,
    metadata: { contact_id: contactId, name: current.name, was_primary: current.is_primary },
  }, client)
}
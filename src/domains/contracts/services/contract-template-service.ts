import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'
import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'
import { contractTemplateSchema } from '@/domains/contracts/schemas/contract-template-schema'
import type { ContractTemplateInput } from '@/domains/contracts/schemas/contract-template-schema'
import type { ContractTemplate } from '@/domains/contracts/types'

export async function createContractTemplate(
  workspaceId: string,
  values: ContractTemplateInput,
  createdByMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<ContractTemplate> {
  if (!workspaceId.trim()) {
    throw new DomainError('O workspace precisa estar resolvido antes desta operação.', 'WORKSPACE_REQUIRED')
  }
  const parsedValues = contractTemplateSchema.parse(values)
  if (createdByMemberId) {
    const { data: member, error: memberError } = await client.from('workspace_members').select('id')
      .eq('workspace_id', workspaceId).eq('id', createdByMemberId).eq('status', 'active').maybeSingle()
    if (memberError) throw mapDatabaseError(memberError)
    if (!member) throw new DomainError('O autor não está ativo neste workspace.', 'WORKSPACE_MEMBER_NOT_FOUND')
  }

  const { data, error } = await client.from('contract_templates').insert({
    ...parsedValues,
    body_json: parsedValues.body_json ?? {},
    workspace_id: workspaceId,
    created_by_member_id: createdByMemberId ?? null,
  }).select('*').single()
  if (error) throw mapDatabaseError(error)
  if (!data) throw new DomainError('Não foi possível criar o modelo de contrato.', 'CONTRACT_TEMPLATE_CREATE_FAILED')
  return data
}
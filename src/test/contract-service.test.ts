import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createContract } from '@/domains/contracts/services/contract-service'
import type { Database } from '@/lib/supabase/database.types'

describe('serviço de contratos', () => {
  it('copia o conteúdo de um modelo ativo do mesmo workspace na criação', async () => {
    const templateId = 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3'
    const clientId = '8ce8dce5-e690-4f28-86b3-327ea393cd2f'
    const templateBody = { sections: [{ heading: 'Escopo', text: 'Conteúdo versionado' }] }
    const clientLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: clientId }, error: null }),
    }
    const templateLookup = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: templateId, workspace_id: 'workspace-1', status: 'active', body_json: templateBody, body_text: 'Texto' },
        error: null,
      }),
    }
    const inserted: Array<Record<string, unknown>> = []
    const contractInsert = {
      insert: vi.fn((values: Record<string, unknown>) => {
        inserted.push(values)
        return {
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { ...values, id: 'contract-1', created_at: '', updated_at: '' },
            error: null,
          }),
        }
      }),
    }
    const activityInsert = { insert: vi.fn().mockResolvedValue({ error: null }) }
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'clients') return clientLookup
        if (table === 'contract_templates') return templateLookup
        if (table === 'contracts') return contractInsert
        return activityInsert
      }),
    } as unknown as SupabaseClient<Database>

    const contract = await createContract('workspace-1', clientId, {
      title: 'Contrato mensal',
      source_type: 'template',
      template_id: templateId,
    }, 'member-1', client)

    expect(clientLookup.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
    expect(templateLookup.eq).toHaveBeenCalledWith('workspace_id', 'workspace-1')
    expect(templateLookup.eq).toHaveBeenCalledWith('status', 'active')
    expect(inserted[0]).toMatchObject({
      workspace_id: 'workspace-1',
      client_id: clientId,
      template_id: templateId,
      body_json: templateBody,
      body_text: 'Texto',
    })
    expect(contract.body_json).toEqual(templateBody)
  })
})
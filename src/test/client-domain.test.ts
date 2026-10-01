import { describe, expect, it } from 'vitest'
import { isValidCnpj, clientSchema } from '@/domains/clients/schemas/client-schema'
import { contactSchema } from '@/domains/clients/schemas/contact-schema'
import { clientKeys } from '@/domains/clients/queries/client-keys'
import { contractKeys } from '@/domains/contracts/queries/contract-keys'
import { projectKeys } from '@/domains/projects/queries/project-keys'
import { mapDatabaseError } from '@/domains/shared/domain-error'
import { formatCnpj, formatPhone, normalizeCnpj, normalizePhone } from '@/domains/clients/formatters'
import { clientStatusSchema } from '@/domains/clients/schemas/client-schema'

describe('domínio de clientes e contatos', () => {
  it('valida CNPJ com e sem máscara e rejeita dígitos verificadores inválidos', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11222333000181')).toBe(true)
    expect(isValidCnpj('11.222.333/0001-80')).toBe(false)
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false)
  })

  it('valida datas do cliente e normaliza campos opcionais vazios', () => {
    const parsed = clientSchema.safeParse({
      display_name: 'Agência Time',
      cnpj: '11.222.333/0001-81',
      joined_on: '2026-03-01',
      ended_on: '2026-02-28',
    })
    expect(parsed.success).toBe(false)

    const valid = clientSchema.parse({ display_name: ' Agência Time ', phone: '', email: '' })
    expect(valid.display_name).toBe('Agência Time')
    expect(valid.phone).toBeNull()
    expect(valid.email).toBeNull()
    expect(valid.status).toBe('active')
  })

  it('aceita somente os status de cliente previstos pelo banco', () => {
    for (const status of ['active', 'paused', 'inactive']) {
      expect(clientStatusSchema.safeParse(status).success).toBe(true)
    }
    expect(clientStatusSchema.safeParse('deleted').success).toBe(false)
  })

  it('valida dados relevantes de contato', () => {
    expect(contactSchema.safeParse({ name: 'A', email: 'incorreto' }).success).toBe(false)
    expect(contactSchema.safeParse({ name: 'Ana Silva', phone: '--------' }).success).toBe(false)
    expect(contactSchema.parse({ name: 'Ana Silva', email: 'ana@empresa.com', is_primary: true }).is_primary).toBe(true)
  })

  it('separa apresentação e persistência de CNPJ e telefone', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181')
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(normalizePhone('(11) 99999-9999')).toBe('11999999999')
    expect(formatPhone('11999999999')).toBe('(11) 99999-9999')
  })

  it('organiza query keys por recurso, workspace e entidade', () => {
    expect(clientKeys.list('workspace-1', { status: 'active' })).toEqual([
      'clients', 'list', 'workspace-1', { status: 'active' },
    ])
    expect(clientKeys.contacts('workspace-1', 'client-1')).toEqual([
      'clients', 'contacts', 'workspace-1', 'client-1',
    ])
    expect(contractKeys.list('workspace-1', 'client-1')).toEqual([
      'contracts', 'list', 'workspace-1', 'client-1',
    ])
    expect(projectKeys.squad('workspace-1', 'project-1')).toEqual([
      'projects', 'squad', 'workspace-1', 'project-1',
    ])
  })

  it('mapeia CNPJ duplicado e preserva erros desconhecidos', () => {
    expect(mapDatabaseError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "clients_workspace_cnpj_unique"',
    }).message).toBe('Já existe um cliente com este CNPJ.')
    expect(mapDatabaseError({ code: 'XX000', message: 'falha inesperada' }).message).toBe('falha inesperada')
  })
})
import { describe, expect, it } from 'vitest'
import { projectMemberSchema, projectSchema, projectStatusSchema, projectFileReferenceSchema } from '@/domains/projects/schemas/project-schema'

describe('domínio de projetos', () => {
  it('aceita somente os status de projeto existentes', () => {
    for (const status of ['active', 'paused', 'completed']) {
      expect(projectStatusSchema.safeParse(status).success).toBe(true)
    }
    expect(projectStatusSchema.safeParse('cancelled').success).toBe(false)
  })

  it('exige cliente válido e datas coerentes', () => {
    expect(projectSchema.safeParse({ client_id: 'invalid', name: 'Projeto' }).success).toBe(false)
    expect(projectSchema.safeParse({
      client_id: 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3',
      name: 'Projeto',
      start_date: '2026-08-20',
      planned_end_date: '2026-08-19',
    }).success).toBe(false)
  })

  it('valida squad e normaliza papel vazio', () => {
    const parsed = projectMemberSchema.parse({
      member_id: 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3',
      role_label: '',
      is_lead: true,
    })
    expect(parsed).toMatchObject({ role_label: null, is_lead: true })
  })

  it('representa arquivo em storage e link externo sem configurar uploads', () => {
    expect(projectFileReferenceSchema.safeParse({
      source_type: 'upload', file_name: 'brief.pdf', storage_path: 'workspace/project/brief.pdf',
    }).success).toBe(true)
    expect(projectFileReferenceSchema.safeParse({
      source_type: 'link', file_name: 'Figma', external_url: 'https://figma.com/file/1',
    }).success).toBe(true)
    expect(projectFileReferenceSchema.safeParse({
      source_type: 'link', file_name: 'Figma', external_url: 'javascript:alert(1)',
    }).success).toBe(false)
  })
})
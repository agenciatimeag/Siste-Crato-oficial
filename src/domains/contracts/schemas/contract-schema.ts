import { z } from 'zod'

const nullableDate = z.string().trim().nullish().transform((value) => value || null)

export const contractStatusSchema = z.enum(['draft', 'active', 'paused', 'ended', 'cancelled'])

export const contractSchema = z.object({
  template_id: z.string().uuid().nullish().transform((value) => value || null),
  title: z.string().trim().min(2, 'Informe o título do contrato.').max(240),
  code: z.string().trim().max(100).nullish().transform((value) => value || null),
  source_type: z.enum(['template', 'manual', 'upload']),
  status: contractStatusSchema.default('draft'),
  body_json: z.unknown().optional(),
  body_text: z.string().nullish().transform((value) => value || null),
  start_date: nullableDate.refine((value) => value === null || z.iso.date().safeParse(value).success, 'Informe uma data inicial válida.'),
  end_date: nullableDate.refine((value) => value === null || z.iso.date().safeParse(value).success, 'Informe uma data final válida.'),
  signed_at: z.string().datetime({ offset: true }).nullish().transform((value) => value || null),
  notes: z.string().trim().max(10000).nullish().transform((value) => value || null),
}).superRefine((contract, context) => {
  if (contract.source_type === 'template' && !contract.template_id) {
    context.addIssue({ code: 'custom', path: ['template_id'], message: 'Selecione um modelo para contratos com origem em modelo.' })
  }
  if (contract.start_date && contract.end_date && contract.end_date < contract.start_date) {
    context.addIssue({ code: 'custom', path: ['end_date'], message: 'A data final não pode ser anterior à data inicial.' })
  }
})
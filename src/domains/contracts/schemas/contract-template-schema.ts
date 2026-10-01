import { z } from 'zod'

export const contractTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do modelo.').max(240),
  description: z.string().trim().max(10000).nullish().transform((value) => value || null),
  body_json: z.unknown().optional(),
  body_text: z.string().nullish().transform((value) => value || null),
  status: z.enum(['active', 'inactive']).default('active'),
})

export type ContractTemplateInput = z.infer<typeof contractTemplateSchema>
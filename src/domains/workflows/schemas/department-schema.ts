import { z } from 'zod'

export const departmentSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do departamento.').max(160),
  description: z.string().trim().max(4000).nullish().transform((value) => value || null),
  is_active: z.boolean().default(true),
})

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(4000).nullish().optional(),
  is_active: z.boolean().optional(),
})
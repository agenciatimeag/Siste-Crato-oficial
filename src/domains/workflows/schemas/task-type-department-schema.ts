import { z } from 'zod'

export const taskTypeDepartmentSchema = z.object({
  department_id: z.string().uuid('Selecione um departamento válido.'),
  position: z.number().int().positive().optional(),
  is_active: z.boolean().default(true),
})

export const taskTypeDepartmentUpdateSchema = z.object({
  position: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
})

export const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
}).superRefine(({ orderedIds }, context) => {
  if (new Set(orderedIds).size !== orderedIds.length) {
    context.addIssue({ code: 'custom', path: ['orderedIds'], message: 'A ordenação contém itens duplicados.' })
  }
})
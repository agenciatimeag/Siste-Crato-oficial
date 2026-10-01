import { z } from 'zod'

const checklistTitleSchema = z.string().trim().min(1, 'Informe o título do item.').max(500)

export const checklistItemCreateSchema = z.object({
  title: checklistTitleSchema,
  position: z.number().int().positive().optional(),
}).strict()

export const checklistItemUpdateSchema = z.object({
  title: checklistTitleSchema,
}).strict()

export const checklistReorderSchema = z.array(z.string().uuid()).min(1).refine(
  (itemIds) => new Set(itemIds).size === itemIds.length,
  'A ordenação não pode conter itens repetidos.',
)
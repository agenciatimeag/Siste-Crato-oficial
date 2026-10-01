import { z } from 'zod'

const taskFileBaseSchema = z.object({
  file_name: z.string().trim().min(1, 'Informe o nome do arquivo.').max(255),
  mime_type: z.string().trim().max(255).nullish().transform((value) => value ?? null),
  size_bytes: z.number().int().nonnegative().nullish().transform((value) => value ?? null),
  storage_path: z.string().trim().min(1).max(1000).nullish().transform((value) => value ?? null),
})

export const taskFileCreateSchema = z.discriminatedUnion('kind', [
  taskFileBaseSchema.extend({ kind: z.literal('attachment'), comment_id: z.null().optional() }),
  taskFileBaseSchema.extend({ kind: z.literal('final_delivery'), comment_id: z.null().optional() }),
  taskFileBaseSchema.extend({ kind: z.literal('comment_attachment'), comment_id: z.string().uuid() }),
])
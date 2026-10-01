import { z } from 'zod'

const commentBodySchema = z.string().trim().min(1, 'Informe o comentário.').max(10000)

export const taskCommentCreateSchema = z.object({
  body: commentBodySchema,
  reply_to_comment_id: z.string().uuid().nullish().transform((value) => value ?? null),
}).strict()

export const taskCommentUpdateSchema = z.object({
  body: commentBodySchema,
}).strict()
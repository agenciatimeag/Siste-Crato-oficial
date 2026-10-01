import { z } from 'zod'

const nullableDate = z.string().trim().nullish().transform((value) => value || null)

export const projectStatusSchema = z.enum(['active', 'paused', 'completed'])

export const projectSchema = z.object({
  client_id: z.string().uuid('Selecione um cliente válido.'),
  name: z.string().trim().min(2, 'Informe o nome do projeto.').max(240),
  description: z.string().trim().max(10000).nullish().transform((value) => value || null),
  status: projectStatusSchema.default('active'),
  start_date: z.iso.date().optional(),
  planned_end_date: nullableDate.refine((value) => value === null || z.iso.date().safeParse(value).success, 'Informe uma data final válida.'),
  completed_at: z.string().datetime({ offset: true }).nullish().transform((value) => value || null),
  owner_member_id: z.string().uuid().nullish().transform((value) => value || null),
  notes: z.string().trim().max(10000).nullish().transform((value) => value || null),
}).superRefine((project, context) => {
  if (project.start_date && project.planned_end_date && project.planned_end_date < project.start_date) {
    context.addIssue({ code: 'custom', path: ['planned_end_date'], message: 'A previsão de término não pode ser anterior ao início.' })
  }
})

export const projectMemberSchema = z.object({
  member_id: z.string().uuid('Selecione um membro válido.'),
  role_label: z.string().trim().max(120).nullish().transform((value) => value || null),
  is_lead: z.boolean().default(false),
})

export const projectMemberUpdateSchema = z.object({
  role_label: z.string().trim().max(120).nullish().transform((value) => value || null),
  is_lead: z.boolean(),
})

export const projectFileReferenceSchema = z.discriminatedUnion('source_type', [
  z.object({
    source_type: z.literal('upload'),
    file_name: z.string().trim().min(1).max(255),
    storage_path: z.string().trim().min(1),
    external_url: z.null().optional(),
    mime_type: z.string().trim().max(255).nullish(),
    size_bytes: z.number().int().nonnegative().nullish(),
    description: z.string().trim().max(10000).nullish(),
    uploaded_by_member_id: z.string().uuid().nullish(),
  }),
  z.object({
    source_type: z.literal('link'),
    file_name: z.string().trim().min(1).max(255),
    storage_path: z.null().optional(),
    external_url: z.url('Informe um link válido.').refine((value) => {
      const protocol = new URL(value).protocol
      return protocol === 'https:' || protocol === 'http:'
    }, 'O link precisa usar HTTP ou HTTPS.'),
    mime_type: z.string().trim().max(255).nullish(),
    size_bytes: z.number().int().nonnegative().nullish(),
    description: z.string().trim().max(10000).nullish(),
    uploaded_by_member_id: z.string().uuid().nullish(),
  }),
])
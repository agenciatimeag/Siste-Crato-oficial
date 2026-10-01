import { z } from 'zod'

const sprintFields = z.object({
  name: z.string().trim().min(2, 'Informe o nome da Sprint.').max(120),
  start_date: z.string().nullish().transform((value) => value ?? null)
    .refine((value) => value === null || z.iso.date().safeParse(value).success, 'Informe uma data inicial válida.'),
  end_date: z.string().nullish().transform((value) => value ?? null)
    .refine((value) => value === null || z.iso.date().safeParse(value).success, 'Informe uma data final válida.'),
  is_active: z.boolean().default(true),
})

function validateSprintDates(
  sprint: { start_date?: string | null; end_date?: string | null },
  context: z.RefinementCtx,
) {
  if (sprint.start_date && sprint.end_date && sprint.end_date < sprint.start_date) {
    context.addIssue({ code: 'custom', path: ['end_date'], message: 'O término da Sprint não pode ser anterior ao início.' })
  }
}

export const sprintSchema = sprintFields.superRefine(validateSprintDates)
export const sprintUpdateSchema = sprintFields.partial().superRefine(validateSprintDates)
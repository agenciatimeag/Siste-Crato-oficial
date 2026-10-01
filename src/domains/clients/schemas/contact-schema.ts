import { z } from 'zod'
import { isValidPhoneInput } from '@/domains/clients/formatters'

const optionalText = z.string().trim().max(200).nullish().transform((value) => value || null)

export const contactSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do contato.').max(200),
  role_title: optionalText,
  phone: z.string().trim().nullish().transform((value) => value || null)
    .refine((value) => value === null || isValidPhoneInput(value), 'Informe um telefone válido.'),
  email: z.string().trim().nullish().transform((value) => value || null)
    .refine((value) => value === null || z.email().safeParse(value).success, 'Informe um e-mail válido.'),
  is_primary: z.boolean().default(false),
  notes: z.string().trim().max(10000).nullish().transform((value) => value || null),
})

export type ContactInput = z.infer<typeof contactSchema>
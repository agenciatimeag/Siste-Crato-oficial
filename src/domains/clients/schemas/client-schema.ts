import { z } from 'zod'
import { isValidPhoneInput } from '@/domains/clients/formatters'

const optionalText = z.string().trim().max(200).nullish().transform((value) => value || null)
const dateInput = z.string().trim().nullish().transform((value) => value || null)

export function isValidCnpj(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length !== 14 || /^([0-9])\1{13}$/.test(digits)) return false

  const calculateDigit = (base: string, weights: number[]) => {
    const sum = [...base].reduce((total, digit, index) => total + Number(digit) * weights[index], 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const secondDigit = calculateDigit(digits.slice(0, 12) + firstDigit, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return digits.endsWith(`${firstDigit}${secondDigit}`)
}

const cnpjInput = z.string().trim().nullish().transform((value) => value || null)
  .refine((value) => value === null || isValidCnpj(value), 'Informe um CNPJ válido.')

const phoneInput = z.string().trim().nullish().transform((value) => value || null)
  .refine((value) => value === null || isValidPhoneInput(value), 'Informe um telefone válido.')

const emailInput = z.string().trim().nullish().transform((value) => value || null)
  .refine((value) => value === null || z.email().safeParse(value).success, 'Informe um e-mail válido.')

export const clientStatusSchema = z.enum(['active', 'paused', 'inactive'])

export const clientSchema = z.object({
  display_name: z.string().trim().min(2, 'Informe o nome do cliente.').max(200),
  legal_name: optionalText,
  trade_name: optionalText,
  cnpj: cnpjInput,
  phone: phoneInput,
  email: emailInput,
  status: clientStatusSchema.default('active'),
  account_manager_member_id: z.string().uuid().nullish().transform((value) => value || null),
  joined_on: dateInput.refine((value) => value === null || z.iso.date().safeParse(value).success, 'Informe uma data válida.'),
  ended_on: dateInput.refine((value) => value === null || z.iso.date().safeParse(value).success, 'Informe uma data válida.'),
  notes: z.string().trim().max(10000).nullish().transform((value) => value || null),
}).superRefine((client, context) => {
  if (client.joined_on && client.ended_on && client.ended_on < client.joined_on) {
    context.addIssue({ code: 'custom', path: ['ended_on'], message: 'A data de encerramento não pode ser anterior à entrada.' })
  }
})

export type ClientInput = z.infer<typeof clientSchema>
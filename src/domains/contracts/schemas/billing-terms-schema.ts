import { z } from 'zod'

const nonNegativeCents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const dueDay = z.number().int().min(1).max(31)
const firstDueDate = z.iso.date()
const notes = z.string().trim().max(10000).nullish().transform((value) => value || null)

export const billingTermsSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('recurring'),
    recurring_amount_cents: nonNegativeCents,
    due_day: dueDay,
    first_due_date: firstDueDate,
    notes,
  }),
  z.object({
    mode: z.literal('one_time'),
    total_amount_cents: nonNegativeCents,
    first_due_date: firstDueDate,
    notes,
  }),
  z.object({
    mode: z.literal('installments'),
    total_amount_cents: nonNegativeCents,
    installment_count: z.number().int().positive().max(120),
    installment_amount_cents: nonNegativeCents,
    first_due_date: firstDueDate,
    due_day: dueDay.nullish().transform((value) => value ?? null),
    notes,
  }),
])
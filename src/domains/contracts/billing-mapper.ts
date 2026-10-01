import type { Database } from '@/lib/supabase/database.types'
import type { BillingTermsInput } from '@/domains/contracts/types'

type BillingTermsInsert = Database['public']['Tables']['contract_billing_terms']['Insert']

export function toBillingTermsInsert(
  workspaceId: string,
  contractId: string,
  values: BillingTermsInput,
): BillingTermsInsert {
  const base = {
    workspace_id: workspaceId,
    contract_id: contractId,
    currency: 'BRL' as const,
    total_amount_cents: null,
    recurring_amount_cents: null,
    installment_amount_cents: null,
    installment_count: null,
    due_day: null,
    first_due_date: null,
    notes: values.notes ?? null,
  }

  if (values.mode === 'recurring') {
    return {
      ...base,
      billing_mode: 'recurring',
      recurring_amount_cents: values.recurring_amount_cents,
      due_day: values.due_day,
      first_due_date: values.first_due_date,
    }
  }
  if (values.mode === 'one_time') {
    return {
      ...base,
      billing_mode: 'upfront',
      total_amount_cents: values.total_amount_cents,
      first_due_date: values.first_due_date,
    }
  }
  return {
    ...base,
    billing_mode: 'installment',
    total_amount_cents: values.total_amount_cents,
    installment_count: values.installment_count,
    installment_amount_cents: values.installment_amount_cents,
    first_due_date: values.first_due_date,
    due_day: values.due_day ?? null,
  }
}
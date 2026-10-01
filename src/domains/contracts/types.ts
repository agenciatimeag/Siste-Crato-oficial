import type { Database } from '@/lib/supabase/database.types'

export type Contract = Database['public']['Tables']['contracts']['Row']
export type ContractTemplate = Database['public']['Tables']['contract_templates']['Row']
export type ContractStatus = Contract['status']
export type ContractSource = Contract['source_type']
export type ContractBillingTerms = Database['public']['Tables']['contract_billing_terms']['Row']

export type ContractInput = {
  template_id?: string | null
  title: string
  code?: string | null
  source_type: ContractSource
  status?: ContractStatus
  body_json?: unknown
  body_text?: string | null
  start_date?: string | null
  end_date?: string | null
  signed_at?: string | null
  notes?: string | null
}

export type BillingTermsInput =
  | { mode: 'recurring'; recurring_amount_cents: number; due_day: number; first_due_date: string; notes?: string | null }
  | { mode: 'one_time'; total_amount_cents: number; first_due_date: string; notes?: string | null }
  | { mode: 'installments'; total_amount_cents: number; installment_count: number; installment_amount_cents: number; first_due_date: string; due_day?: number | null; notes?: string | null }

export type ContractTermAttention = 'normal' | 'attention' | 'urgent' | 'expired'

export type ContractTerm = {
  daysRemaining: number | null
  isExpired: boolean
  attention: ContractTermAttention
}
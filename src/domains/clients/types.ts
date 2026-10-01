import type { Database } from '@/lib/supabase/database.types'

export type Client = Database['public']['Tables']['clients']['Row']
export type ClientContact = Database['public']['Tables']['client_contacts']['Row']
export type ClientStatus = Client['status']

export type ClientFormValues = {
  display_name: string
  legal_name?: string | null
  trade_name?: string | null
  cnpj?: string | null
  phone?: string | null
  email?: string | null
  status?: ClientStatus
  account_manager_member_id?: string | null
  joined_on?: string | null
  ended_on?: string | null
  notes?: string | null
}

export type ContactFormValues = {
  name: string
  role_title?: string | null
  phone?: string | null
  email?: string | null
  is_primary?: boolean
  notes?: string | null
}

export type ClientListFilters = {
  search?: string
  status?: ClientStatus | 'all'
}
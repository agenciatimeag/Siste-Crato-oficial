type Table<Row, Insert> = {
  Row: Row
  Insert: Insert
  Update: Partial<Insert>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      workspaces: Table<
        { id: string; name: string; slug: string | null; created_by_user_id: string; created_at: string; updated_at: string },
        { id?: string; name: string; slug?: string | null; created_by_user_id?: string; created_at?: string; updated_at?: string }
      >
      workspace_members: Table<
        { id: string; workspace_id: string; user_id: string; role: 'owner' | 'admin' | 'member'; status: 'active' | 'inactive'; job_title: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; user_id: string; role?: 'owner' | 'admin' | 'member'; status?: 'active' | 'inactive'; job_title?: string | null; created_at?: string; updated_at?: string }
      >
      clients: Table<
        { id: string; workspace_id: string; display_name: string; legal_name: string | null; trade_name: string | null; cnpj: string | null; phone: string | null; email: string | null; status: 'active' | 'paused' | 'inactive'; account_manager_member_id: string | null; notes: string | null; joined_on: string; ended_on: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; display_name: string; legal_name?: string | null; trade_name?: string | null; cnpj?: string | null; phone?: string | null; email?: string | null; status?: 'active' | 'paused' | 'inactive'; account_manager_member_id?: string | null; notes?: string | null; joined_on?: string; ended_on?: string | null; created_at?: string; updated_at?: string }
      >
      client_contacts: Table<
        { id: string; workspace_id: string; client_id: string; name: string; role_title: string | null; email: string | null; phone: string | null; is_primary: boolean; notes: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; client_id: string; name: string; role_title?: string | null; email?: string | null; phone?: string | null; is_primary?: boolean; notes?: string | null; created_at?: string; updated_at?: string }
      >
      contract_templates: Table<
        { id: string; workspace_id: string; name: string; description: string | null; body_json: unknown; body_text: string | null; status: 'active' | 'inactive'; created_by_member_id: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; name: string; description?: string | null; body_json?: unknown; body_text?: string | null; status?: 'active' | 'inactive'; created_by_member_id?: string | null; created_at?: string; updated_at?: string }
      >
      contracts: Table<
        { id: string; workspace_id: string; client_id: string; template_id: string | null; title: string; code: string | null; source_type: 'template' | 'manual' | 'upload'; status: 'draft' | 'active' | 'paused' | 'ended' | 'cancelled'; body_json: unknown; body_text: string | null; start_date: string | null; end_date: string | null; signed_at: string | null; notes: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; client_id: string; template_id?: string | null; title: string; code?: string | null; source_type?: 'template' | 'manual' | 'upload'; status?: 'draft' | 'active' | 'paused' | 'ended' | 'cancelled'; body_json?: unknown; body_text?: string | null; start_date?: string | null; end_date?: string | null; signed_at?: string | null; notes?: string | null; created_at?: string; updated_at?: string }
      >
      contract_billing_terms: Table<
        { id: string; workspace_id: string; contract_id: string; billing_mode: 'recurring' | 'upfront' | 'installment'; currency: 'BRL'; total_amount_cents: number | null; recurring_amount_cents: number | null; installment_amount_cents: number | null; installment_count: number | null; due_day: number | null; first_due_date: string | null; notes: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; contract_id: string; billing_mode: 'recurring' | 'upfront' | 'installment'; currency?: 'BRL'; total_amount_cents?: number | null; recurring_amount_cents?: number | null; installment_amount_cents?: number | null; installment_count?: number | null; due_day?: number | null; first_due_date?: string | null; notes?: string | null; created_at?: string; updated_at?: string }
      >
      projects: Table<
        { id: string; workspace_id: string; client_id: string; name: string; description: string | null; status: 'active' | 'paused' | 'completed'; start_date: string; planned_end_date: string | null; completed_at: string | null; owner_member_id: string | null; notes: string | null; created_at: string; updated_at: string },
        { id?: string; workspace_id: string; client_id: string; name: string; description?: string | null; status?: 'active' | 'paused' | 'completed'; start_date?: string; planned_end_date?: string | null; completed_at?: string | null; owner_member_id?: string | null; notes?: string | null; created_at?: string; updated_at?: string }
      >
      project_members: Table<
        { id: string; workspace_id: string; project_id: string; member_id: string; role_label: string | null; is_lead: boolean; created_at: string },
        { id?: string; workspace_id: string; project_id: string; member_id: string; role_label?: string | null; is_lead?: boolean; created_at?: string }
      >
      project_files: Table<
        { id: string; workspace_id: string; project_id: string; source_type: 'upload' | 'link'; file_name: string; storage_path: string | null; external_url: string | null; mime_type: string | null; size_bytes: number | null; description: string | null; uploaded_by_member_id: string | null; created_at: string },
        { id?: string; workspace_id: string; project_id: string; source_type?: 'upload' | 'link'; file_name: string; storage_path?: string | null; external_url?: string | null; mime_type?: string | null; size_bytes?: number | null; description?: string | null; uploaded_by_member_id?: string | null; created_at?: string }
      >
      activity_log: Table<
        { id: string; workspace_id: string; entity_type: 'client' | 'contract' | 'project'; entity_id: string; action: string; actor_member_id: string | null; metadata: Record<string, unknown>; created_at: string },
        { id?: string; workspace_id: string; entity_type: 'client' | 'contract' | 'project'; entity_id: string; action: string; actor_member_id?: string | null; metadata?: Record<string, unknown>; created_at?: string }
      >
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
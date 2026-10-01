import type { Database } from '@/lib/supabase/database.types'

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectMember = Database['public']['Tables']['project_members']['Row']
export type ProjectFile = Database['public']['Tables']['project_files']['Row']
export type ProjectStatus = Project['status']

export type ProjectInput = {
  client_id: string
  name: string
  description?: string | null
  status?: ProjectStatus
  start_date?: string
  planned_end_date?: string | null
  completed_at?: string | null
  owner_member_id?: string | null
  notes?: string | null
}

export type ProjectMemberInput = {
  member_id: string
  role_label?: string | null
  is_lead?: boolean
}

export type ProjectFileReferenceInput = {
  source_type: 'upload' | 'link'
  file_name: string
  storage_path?: string | null
  external_url?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  description?: string | null
  uploaded_by_member_id?: string | null
}
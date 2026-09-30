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
        {
          id: string
          name: string
          slug: string | null
          created_by_user_id: string
          created_at: string
          updated_at: string
        },
        {
          id?: string
          name: string
          slug?: string | null
          created_by_user_id?: string
          created_at?: string
          updated_at?: string
        }
      >
      workspace_members: Table<
        {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          status: 'active' | 'inactive'
          job_title: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          status?: 'active' | 'inactive'
          job_title?: string | null
          created_at?: string
          updated_at?: string
        }
      >
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
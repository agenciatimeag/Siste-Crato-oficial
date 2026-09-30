import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export type SupabaseEnvironment = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

export function readSupabaseConfig(environment: SupabaseEnvironment) {
  const url = environment.VITE_SUPABASE_URL?.trim()
  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  const missing = [
    !url && 'VITE_SUPABASE_URL',
    !publishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new Error(
      `Configuração do Supabase incompleta. Defina ${missing.join(' e ')} no arquivo .env.local e reinicie o servidor.`,
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url!)
  } catch {
    throw new Error('VITE_SUPABASE_URL precisa ser uma URL válida.')
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('VITE_SUPABASE_URL precisa usar o protocolo HTTPS ou HTTP.')
  }

  return { url: url!, publishableKey: publishableKey! }
}

const config = readSupabaseConfig(import.meta.env)

export const supabase = createClient<Database>(config.url, config.publishableKey)
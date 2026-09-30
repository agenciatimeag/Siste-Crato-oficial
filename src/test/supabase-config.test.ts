import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from '@/lib/supabase/client'

describe('configuração do Supabase', () => {
  it('falha com uma mensagem explícita quando as variáveis estão ausentes', () => {
    expect(() => readSupabaseConfig({})).toThrow(/VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY/)
  })

  it('rejeita uma URL inválida', () => {
    expect(() => readSupabaseConfig({
      VITE_SUPABASE_URL: 'not-a-url',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    })).toThrow(/URL válida/)
  })

  it('lê URL e publishable key sem transformá-los', () => {
    const config = readSupabaseConfig({
      VITE_SUPABASE_URL: 'https://project.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    })
    expect(config).toEqual({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
    })
  })
})
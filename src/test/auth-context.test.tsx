import { render, screen } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/domains/auth/auth-context'
import type { Database } from '@/lib/supabase/database.types'

const restoredSession = { user: { id: 'user-1', email: 'ana@agencia.com' } }

function SessionProbe() {
  const { session, isLoading } = useAuth()
  return <p>{isLoading ? 'Restaurando sessão' : session?.user.id ?? 'Sem sessão'}</p>
}

describe('restauração de sessão', () => {
  it('restaura a sessão salva sem solicitar uma sessão externa', async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: restoredSession },
      error: null,
    })
    const unsubscribe = vi.fn()
    const client = {
      auth: {
        getSession,
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
      },
    } as unknown as SupabaseClient<Database>

    const { unmount } = render(
      <AuthProvider client={client}>
        <SessionProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('Restaurando sessão')).toBeInTheDocument()
    expect(await screen.findByText('user-1')).toBeInTheDocument()
    expect(getSession).toHaveBeenCalledOnce()
    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('encerra o estado de carregamento quando a restauração falha', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: new Error('storage indisponível') }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    } as unknown as SupabaseClient<Database>

    render(
      <AuthProvider client={client}>
        <SessionProbe />
      </AuthProvider>,
    )

    expect(await screen.findByText('Sem sessão')).toBeInTheDocument()
  })
})
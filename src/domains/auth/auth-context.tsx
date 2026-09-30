import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

type AuthContextValue = {
  session: Session | null
  isLoading: boolean
  initializationError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (fullName: string, email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

type AuthProviderProps = PropsWithChildren<{
  client?: SupabaseClient<Database>
}>

export function AuthProvider({ children, client = supabase }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [initializationError, setInitializationError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return
      setSession(nextSession)
      setIsLoading(false)
      setInitializationError(null)
    })

    void client.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return
      if (error) {
        setInitializationError(error.message)
      } else {
        setSession(data.session)
      }
      setIsLoading(false)
    }).catch((error: unknown) => {
      if (!isMounted) return
      setInitializationError(error instanceof Error ? error.message : 'Erro ao restaurar a sessão.')
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [client])

  async function signIn(email: string, password: string) {
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(fullName: string, email: string, password: string) {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    return !data.session
  }

  async function signOut() {
    const { error } = await client.auth.signOut()
    if (error) throw error
    setSession(null)
  }

  return (
    <AuthContext.Provider
      value={{ session, isLoading, initializationError, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa ser usado dentro de AuthProvider.')
  return context
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return (error as AuthError | null)?.message ?? 'Não foi possível autenticar. Tente novamente.'
}
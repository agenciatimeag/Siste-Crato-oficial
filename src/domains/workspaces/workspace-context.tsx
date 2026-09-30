import { createContext, useContext, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth } from '@/domains/auth/auth-context'
import { createWorkspaceForUser, getWorkspaceForUser } from '@/domains/workspaces/workspace-service'
import type { Workspace } from '@/domains/workspaces/workspace-service'

type WorkspaceStatus = 'loading' | 'ready' | 'missing' | 'error'

type WorkspaceContextValue = {
  workspace: Workspace | null
  status: WorkspaceStatus
  error: string | null
  reload: () => void
  createWorkspace: (name: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session, isLoading: authIsLoading } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [status, setStatus] = useState<WorkspaceStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const userId = session?.user.id

  useEffect(() => {
    let isMounted = true
    if (authIsLoading) {
      setStatus('loading')
      return () => { isMounted = false }
    }
    if (!userId) {
      setWorkspace(null)
      setStatus('missing')
      setError(null)
      return () => { isMounted = false }
    }

    setStatus('loading')
    setError(null)
    void getWorkspaceForUser(userId).then((nextWorkspace) => {
      if (!isMounted) return
      setWorkspace(nextWorkspace)
      setStatus(nextWorkspace ? 'ready' : 'missing')
    }).catch((loadError: unknown) => {
      if (!isMounted) return
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o espaço de trabalho.')
      setStatus('error')
    })

    return () => { isMounted = false }
  }, [authIsLoading, revision, userId])

  function reload() {
    setRevision((current) => current + 1)
  }

  async function createWorkspace(name: string) {
    if (!userId) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
    setError(null)
    const nextWorkspace = await createWorkspaceForUser(userId, name)
    setWorkspace(nextWorkspace)
    setStatus('ready')
  }

  return (
    <WorkspaceContext.Provider value={{ workspace, status, error, reload, createWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace precisa ser usado dentro de WorkspaceProvider.')
  return context
}
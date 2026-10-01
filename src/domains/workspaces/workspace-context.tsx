import { createContext, useContext, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth } from '@/domains/auth/auth-context'
import {
  createWorkspaceForUser,
  getLastSelectedWorkspaceId,
  listWorkspacesForUser,
  rememberWorkspaceSelection,
  resolveWorkspaceSelection,
} from '@/domains/workspaces/workspace-service'
import type { Workspace } from '@/domains/workspaces/workspace-service'

type WorkspaceStatus = 'loading' | 'ready' | 'missing' | 'selection_required' | 'error'

type WorkspaceContextValue = {
  workspace: Workspace | null
  availableWorkspaces: Workspace[]
  status: WorkspaceStatus
  error: string | null
  reload: () => void
  selectWorkspace: (workspaceId: string) => void
  createWorkspace: (name: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session, isLoading: authIsLoading } = useAuth()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [availableWorkspaces, setAvailableWorkspaces] = useState<Workspace[]>([])
  const [status, setStatus] = useState<WorkspaceStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const userId = session?.user.id

  useEffect(() => {
    let isMounted = true
    if (authIsLoading) {
      setStatus('loading')
      setWorkspace(null)
      setAvailableWorkspaces([])
      return () => { isMounted = false }
    }
    if (!userId) {
      setWorkspace(null)
      setAvailableWorkspaces([])
      setStatus('missing')
      setError(null)
      return () => { isMounted = false }
    }

    setStatus('loading')
    setWorkspace(null)
    setAvailableWorkspaces([])
    setError(null)
    void listWorkspacesForUser(userId).then((nextWorkspaces) => {
      if (!isMounted) return
      const resolution = resolveWorkspaceSelection(
        nextWorkspaces,
        getLastSelectedWorkspaceId(userId),
      )
      setAvailableWorkspaces(nextWorkspaces)
      setWorkspace(resolution.workspace)
      setStatus(resolution.status)
      if (resolution.status === 'ready') {
        rememberWorkspaceSelection(userId, resolution.workspace.id)
      }
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

  function selectWorkspace(workspaceId: string) {
    if (!userId) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
    const selection = resolveWorkspaceSelection(availableWorkspaces, workspaceId)
    if (selection.status !== 'ready') {
      throw new Error('Selecione um workspace ativo desta conta.')
    }
    rememberWorkspaceSelection(userId, selection.workspace.id)
    setWorkspace(selection.workspace)
    setStatus('ready')
    setError(null)
  }

  async function createWorkspace(name: string) {
    if (!userId) throw new Error('Sua sessão expirou. Entre novamente para continuar.')
    setError(null)
    const nextWorkspace = await createWorkspaceForUser(userId, name)
    rememberWorkspaceSelection(userId, nextWorkspace.id)
    setAvailableWorkspaces([nextWorkspace])
    setWorkspace(nextWorkspace)
    setStatus('ready')
  }

  return (
    <WorkspaceContext.Provider value={{
      workspace,
      availableWorkspaces,
      status,
      error,
      reload,
      selectWorkspace,
      createWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace precisa ser usado dentro de WorkspaceProvider.')
  return context
}
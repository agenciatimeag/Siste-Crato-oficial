import type { PropsWithChildren } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { AppStatus } from '@/components/app-status'
import { CreateWorkspacePage } from '@/domains/workspaces/pages/create-workspace-page'
import { SelectWorkspacePage } from '@/domains/workspaces/pages/select-workspace-page'
import { useAuth } from '@/domains/auth/auth-context'
import { useWorkspace } from '@/domains/workspaces/workspace-context'

export function GuestRoute({ children }: PropsWithChildren) {
  const { session, isLoading, initializationError } = useAuth()
  if (isLoading) {
    return <AppStatus loading title="Restaurando sessão" description="Aguarde um instante." />
  }
  if (initializationError) {
    return (
      <AppStatus title="Não foi possível restaurar a sessão" description={initializationError}>
        <button className="form-button status-retry" onClick={() => window.location.reload()} type="button">
          Tentar novamente
        </button>
      </AppStatus>
    )
  }
  return session ? <Navigate replace to="/" /> : children
}

export function WorkspaceRoute() {
  const { session, isLoading, initializationError } = useAuth()
  const { status, error, reload } = useWorkspace()

  if (isLoading) {
    return <AppStatus loading title="Restaurando sessão" description="Aguarde um instante." />
  }
  if (initializationError) {
    return (
      <AppStatus title="Não foi possível restaurar a sessão" description={initializationError}>
        <button className="form-button status-retry" onClick={() => window.location.reload()} type="button">
          Tentar novamente
        </button>
      </AppStatus>
    )
  }
  if (!session) return <Navigate replace to="/login" />
  if (status === 'loading') {
    return <AppStatus loading title="Carregando espaço de trabalho" description="Aguarde um instante." />
  }
  if (status === 'error') {
    return (
      <AppStatus title="Não foi possível carregar seu espaço" description={error ?? 'Tente novamente.'}>
        <button className="form-button status-retry" onClick={reload} type="button">Tentar novamente</button>
      </AppStatus>
    )
  }
  if (status === 'missing') return <CreateWorkspacePage />
  if (status === 'selection_required') return <SelectWorkspacePage />
  return <Outlet />
}
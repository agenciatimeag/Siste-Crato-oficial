import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { getAuthErrorMessage, useAuth } from '@/domains/auth/auth-context'
import { useWorkspace } from '@/domains/workspaces/workspace-context'

export function SelectWorkspacePage() {
  const { availableWorkspaces, selectWorkspace } = useWorkspace()
  const { signOut } = useAuth()
  const [error, setError] = useState<string | null>(null)

  function chooseWorkspace(workspaceId: string) {
    setError(null)
    try {
      selectWorkspace(workspaceId)
    } catch (selectionError) {
      setError(getAuthErrorMessage(selectionError))
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError))
    }
  }

  return (
    <main className="workspace-setup-page">
      <section aria-labelledby="workspace-selection-title" className="workspace-setup-panel">
        <p className="page-eyebrow">CRATO 2.0</p>
        <h1 className="auth-title" id="workspace-selection-title">Selecionar espaço de trabalho</h1>
        <p className="auth-description">Escolha em qual espaço deseja continuar.</p>
        <div aria-label="Workspaces disponíveis" className="workspace-choice-list">
          {availableWorkspaces.map((workspace) => (
            <button
              className="workspace-choice"
              key={workspace.id}
              onClick={() => chooseWorkspace(workspace.id)}
              type="button"
            >
              <span className="workspace-choice-mark" aria-hidden="true">
                {workspace.name.slice(0, 1).toLocaleUpperCase('pt-BR')}
              </span>
              <span className="workspace-choice-name">{workspace.name}</span>
            </button>
          ))}
        </div>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <button className="text-button workspace-signout" onClick={handleSignOut} type="button">
          <LogOut aria-hidden="true" size={15} />
          Sair da conta
        </button>
      </section>
    </main>
  )
}
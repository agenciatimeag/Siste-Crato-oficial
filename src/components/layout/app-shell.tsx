import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth, getAuthErrorMessage } from '@/domains/auth/auth-context'
import { useWorkspace } from '@/domains/workspaces/workspace-context'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const { session, signOut } = useAuth()
  const { workspace } = useWorkspace()

  function closeMobileNav() {
    setMobileNavOpen(false)
  }

  async function handleSignOut() {
    setSignOutError(null)
    try {
      await signOut()
    } catch (error) {
      setSignOutError(getAuthErrorMessage(error))
    }
  }

  return (
    <div className="app-frame">
      <Sidebar
        accountEmail={session?.user.email ?? 'Conta CRATO'}
        isOpen={mobileNavOpen}
        onNavigate={closeMobileNav}
        workspaceName={workspace?.name ?? 'Espaço de trabalho'}
      />
      <button
        aria-label="Fechar navegação"
        aria-hidden={!mobileNavOpen}
        className="sidebar-scrim"
        data-open={mobileNavOpen}
        onClick={closeMobileNav}
        tabIndex={mobileNavOpen ? 0 : -1}
        type="button"
      />
      <div className="main-column">
        <Topbar
          onMenuClick={() => setMobileNavOpen(true)}
          onSignOut={handleSignOut}
          workspaceName={workspace?.name ?? 'Espaço de trabalho'}
        />
        {signOutError && <p className="form-alert shell-alert" role="alert">{signOutError}</p>}
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
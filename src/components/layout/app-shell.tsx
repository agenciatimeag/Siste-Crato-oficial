import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function closeMobileNav() {
    setMobileNavOpen(false)
  }

  return (
    <div className="app-frame">
      <Sidebar isOpen={mobileNavOpen} onNavigate={closeMobileNav} />
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
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
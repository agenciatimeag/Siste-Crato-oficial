import { LogOut, Menu } from 'lucide-react'

type TopbarProps = {
  onMenuClick: () => void
  onSignOut: () => void
  workspaceName: string
}

export function Topbar({ onMenuClick, onSignOut, workspaceName }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-context">
        <button
          aria-label="Abrir navegação"
          className="mobile-menu-button"
          onClick={onMenuClick}
          type="button"
        >
          <Menu aria-hidden="true" size={18} />
        </button>
        <span aria-hidden="true" className="context-dot" />
        <span>{workspaceName}</span>
      </div>
      <div className="topbar-account">
        <span aria-hidden="true" className="avatar">CA</span>
        <button aria-label="Sair da conta" className="icon-button" onClick={onSignOut} type="button">
          <LogOut aria-hidden="true" size={17} />
        </button>
      </div>
    </header>
  )
}
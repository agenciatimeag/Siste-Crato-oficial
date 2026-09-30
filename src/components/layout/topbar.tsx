import { Menu } from 'lucide-react'

type TopbarProps = {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
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
        <span>Espaço de trabalho</span>
      </div>
      <div aria-hidden="true" className="topbar-account">
        <span className="avatar">CA</span>
      </div>
    </header>
  )
}
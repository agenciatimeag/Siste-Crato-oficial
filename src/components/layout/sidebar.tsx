import {
  Building2,
  CheckSquare2,
  Home,
  Layers3,
  Settings2,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

type SidebarProps = {
  isOpen: boolean
  onNavigate: () => void
  accountEmail: string
  workspaceName: string
}

const primaryLinks = [
  { label: 'Visão geral', to: '/', icon: Home, end: true },
  { label: 'Clientes', to: '/clientes', icon: Building2 },
  { label: 'Tarefas', to: '/tarefas', icon: CheckSquare2 },
]

export function Sidebar({ isOpen, onNavigate, accountEmail, workspaceName }: SidebarProps) {
  return (
    <aside aria-label="Navegação principal" className="sidebar" data-open={isOpen}>
      <NavLink aria-label="CRATO, visão geral" className="brand" onClick={onNavigate} to="/">
        <span className="brand-mark">
          <Layers3 aria-hidden="true" size={19} strokeWidth={2.2} />
        </span>
        <span>
          <span className="brand-name">CRATO</span>
          <span className="brand-subtitle">Studio operations</span>
        </span>
      </NavLink>

      <div className="sidebar-content">
        <p className="nav-label">Workspace</p>
        <nav aria-label="Principal">
          <ul className="nav-list">
            {primaryLinks.map(({ label, to, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  className="nav-link"
                  end={end}
                  onClick={onNavigate}
                  to={to}
                >
                  <Icon aria-hidden="true" className="nav-link-icon" strokeWidth={1.8} />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ flex: 1 }} />

        <nav aria-label="Configurações">
          <ul className="nav-list">
            <li>
              <NavLink className="nav-link" onClick={onNavigate} to="/configuracoes">
                <Settings2 aria-hidden="true" className="nav-link-icon" strokeWidth={1.8} />
                <span>Configurações</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <div aria-label="Usuário atual" className="sidebar-footer">
          <span aria-hidden="true" className="avatar">CA</span>
          <span>
            <span className="account-name">{accountEmail}</span>
            <span className="account-caption">{workspaceName}</span>
          </span>
        </div>
      </div>
    </aside>
  )
}
import { ArrowRight, Building2, CheckSquare2, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'

const shortcuts = [
  {
    title: 'Clientes',
    caption: 'Relacionamento',
    to: '/clientes',
    icon: Building2,
  },
  {
    title: 'Tarefas',
    caption: 'Operação',
    to: '/tarefas',
    icon: CheckSquare2,
  },
]

export function OverviewPage() {
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="page-eyebrow">CRATO 2.0</p>
          <h1 className="page-title">Visão geral</h1>
        </div>
        <p className="page-date">{today}</p>
      </header>

      <section aria-labelledby="shortcuts-heading" className="quick-section">
        <h2 className="section-heading" id="shortcuts-heading">Acessos</h2>
        <div className="quick-links">
          {shortcuts.map(({ title, caption, to, icon: Icon }) => (
            <Link className="quick-link" key={to} to={to}>
              <span className="quick-link-content">
                <span className="quick-link-icon">
                  <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="quick-link-title">{title}</span>
                  <span className="quick-link-caption">{caption}</span>
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="quick-link-arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="activity-heading" className="activity-section">
        <h2 className="section-heading" id="activity-heading">Atividade recente</h2>
        <div className="empty-panel">
          <span aria-hidden="true" className="empty-mark">
            <Clock3 size={17} strokeWidth={1.7} />
          </span>
          <p className="empty-title">Nada por aqui ainda</p>
          <p className="empty-description">
            As atualizações do seu espaço de trabalho aparecerão aqui.
          </p>
        </div>
      </section>
    </>
  )
}
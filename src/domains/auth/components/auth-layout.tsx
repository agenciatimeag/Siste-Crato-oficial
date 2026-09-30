import { Layers3 } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type AuthLayoutProps = PropsWithChildren<{
  title: string
  description: string
  footer: ReactNode
}>

export function AuthLayout({ title, description, footer, children }: AuthLayoutProps) {
  return (
    <main className="auth-page">
      <section aria-labelledby="auth-title" className="auth-panel">
        <Link aria-label="CRATO" className="auth-brand" to="/login">
          <span className="brand-mark">
            <Layers3 aria-hidden="true" size={19} strokeWidth={2.2} />
          </span>
          <span className="brand-name">CRATO</span>
        </Link>
        <div className="auth-heading">
          <h1 className="auth-title" id="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
        </div>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
    </main>
  )
}
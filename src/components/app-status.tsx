import type { PropsWithChildren } from 'react'

type AppStatusProps = PropsWithChildren<{
  title: string
  description: string
  loading?: boolean
}>

export function AppStatus({ title, description, loading = false, children }: AppStatusProps) {
  return (
    <main aria-busy={loading} className="app-status-page">
      <section aria-live="polite" className="app-status-panel" role={loading ? 'status' : undefined}>
        {loading && <span aria-hidden="true" className="loading-indicator" />}
        <h1 className="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>
        {children}
      </section>
    </main>
  )
}
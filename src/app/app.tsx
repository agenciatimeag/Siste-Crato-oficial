import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { PagePlaceholder } from '@/components/page-placeholder'
import { OverviewPage } from '@/domains/overview/pages/overview-page'
import { LoginPage } from '@/domains/auth/pages/login-page'
import { SignUpPage } from '@/domains/auth/pages/sign-up-page'
import { GuestRoute, WorkspaceRoute } from '@/app/route-guards'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/cadastro" element={<GuestRoute><SignUpPage /></GuestRoute>} />
      <Route element={<WorkspaceRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route
            path="clientes"
            element={
              <PagePlaceholder
                eyebrow="Relacionamento"
                title="Clientes"
                description="O espaço de clientes está sendo preparado."
                symbol="CL"
              />
            }
          />
          <Route
            path="tarefas"
            element={
              <PagePlaceholder
                eyebrow="Operação"
                title="Tarefas"
                description="O núcleo de tarefas está sendo preparado."
                symbol="TA"
              />
            }
          />
          <Route
            path="configuracoes"
            element={
              <PagePlaceholder
                eyebrow="Espaço de trabalho"
                title="Configurações"
                description="As configurações do espaço serão disponibilizadas aqui."
                symbol="CO"
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
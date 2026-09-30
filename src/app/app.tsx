import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { PagePlaceholder } from '@/components/page-placeholder'
import { OverviewPage } from '@/domains/overview/pages/overview-page'

export function App() {
  return (
    <Routes>
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
    </Routes>
  )
}
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/app'
import { AppProviders } from '@/app/providers'

const routes = [
  { path: '/', heading: 'Visão geral' },
  { path: '/clientes', heading: 'Clientes' },
  { path: '/tarefas', heading: 'Tarefas' },
  { path: '/configuracoes', heading: 'Configurações' },
]

describe('rotas do aplicativo', () => {
  it.each(routes)('renderiza $heading em $path', ({ path, heading }) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppProviders>
          <App />
        </AppProviders>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Navegação principal' })).toBeInTheDocument()
  })
})
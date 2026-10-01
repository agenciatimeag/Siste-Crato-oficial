import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '@/app/app'

const { authMock, workspaceMock } = vi.hoisted(() => ({
  authMock: {
    session: { user: { id: 'user-1', email: 'ana@agencia.com' } } as unknown,
    isLoading: false,
    initializationError: null as string | null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  workspaceMock: {
    workspace: { id: 'workspace-1', name: 'Agência Time' } as unknown,
    availableWorkspaces: [] as Array<{ id: string; name: string; memberId: string }>,
    status: 'ready' as 'ready' | 'missing' | 'selection_required' | 'loading' | 'error',
    error: null as string | null,
    reload: vi.fn(),
    selectWorkspace: vi.fn(),
    createWorkspace: vi.fn(),
  },
}))

vi.mock('@/domains/auth/auth-context', () => ({ useAuth: () => authMock }))
vi.mock('@/domains/workspaces/workspace-context', () => ({ useWorkspace: () => workspaceMock }))

const routes = [
  { path: '/', heading: 'Visão geral' },
  { path: '/clientes', heading: 'Clientes' },
  { path: '/tarefas', heading: 'Tarefas' },
  { path: '/configuracoes', heading: 'Configurações' },
]

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('fluxo de autenticação e rotas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.session = { user: { id: 'user-1', email: 'ana@agencia.com' } }
    authMock.isLoading = false
    authMock.initializationError = null
    workspaceMock.workspace = { id: 'workspace-1', name: 'Agência Time' }
    workspaceMock.availableWorkspaces = []
    workspaceMock.status = 'ready'
    workspaceMock.error = null
  })

  it.each(routes)('renderiza $heading em $path', ({ path, heading }) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('protege rotas privadas e encaminha usuários sem sessão ao login', () => {
    authMock.session = null
    renderAt('/tarefas')
    expect(screen.getByRole('heading', { name: 'Entrar no CRATO' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Tarefas' })).not.toBeInTheDocument()
  })

  it('encaminha usuários autenticados sem workspace para o onboarding', () => {
    workspaceMock.status = 'missing'
    workspaceMock.workspace = null
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Criar espaço de trabalho' })).toBeInTheDocument()
  })

  it('exige seleção quando há múltiplos workspaces sem escolha resolvida', () => {
    workspaceMock.status = 'selection_required'
    workspaceMock.workspace = null
    workspaceMock.availableWorkspaces = [
      { id: 'workspace-1', name: 'Agência Time', memberId: 'member-1' },
      { id: 'workspace-2', name: 'Agência Sul', memberId: 'member-2' },
    ]
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Selecionar espaço de trabalho' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Agência Sul/ }))
    expect(workspaceMock.selectWorkspace).toHaveBeenCalledWith('workspace-2')
  })

  it('envia as credenciais do formulário de login', async () => {
    authMock.session = null
    authMock.signIn.mockResolvedValue(undefined)
    renderAt('/login')

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@agencia.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(authMock.signIn).toHaveBeenCalledWith('ana@agencia.com', 'senha-segura'))
  })

  it('cria uma conta com nome, e-mail e senha', async () => {
    authMock.session = null
    authMock.signUp.mockResolvedValue(true)
    renderAt('/cadastro')

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Silva' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@agencia.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => {
      expect(authMock.signUp).toHaveBeenCalledWith('Ana Silva', 'ana@agencia.com', 'senha-segura')
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Confira seu e-mail')
  })

  it('envia o nome do espaço e permite logout durante o onboarding', async () => {
    workspaceMock.status = 'missing'
    workspaceMock.workspace = null
    renderAt('/')

    fireEvent.change(screen.getByLabelText('Nome do espaço'), { target: { value: 'Agência Time' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar espaço de trabalho' }))
    await waitFor(() => expect(workspaceMock.createWorkspace).toHaveBeenCalledWith('Agência Time'))

    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    await waitFor(() => expect(authMock.signOut).toHaveBeenCalledOnce())
  })

  it('faz logout pelo shell autenticado', async () => {
    authMock.signOut.mockResolvedValue(undefined)
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
    await waitFor(() => expect(authMock.signOut).toHaveBeenCalledOnce())
  })
})
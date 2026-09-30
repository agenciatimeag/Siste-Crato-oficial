import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { useState } from 'react'
import { LogOut, Layers3 } from 'lucide-react'
import { getAuthErrorMessage, useAuth } from '@/domains/auth/auth-context'
import { useWorkspace } from '@/domains/workspaces/workspace-context'

const workspaceSchema = z.object({
  name: z.string().trim().min(2, 'Informe pelo menos 2 caracteres.').max(120),
})

type WorkspaceValues = z.infer<typeof workspaceSchema>

export function CreateWorkspacePage() {
  const { createWorkspace } = useWorkspace()
  const { signOut } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: '' },
  })

  async function onSubmit(values: WorkspaceValues) {
    setSubmitError(null)
    try {
      await createWorkspace(values.name)
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  }

  async function handleSignOut() {
    try {
      await signOut()
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  }

  return (
    <main className="workspace-setup-page">
      <section aria-labelledby="workspace-title" className="workspace-setup-panel">
        <span aria-hidden="true" className="brand-mark">
          <Layers3 size={19} strokeWidth={2.2} />
        </span>
        <p className="page-eyebrow">CRATO 2.0</p>
        <h1 className="auth-title" id="workspace-title">Criar espaço de trabalho</h1>
        <p className="auth-description">Escolha o nome da sua organização para continuar.</p>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <label className="form-field">
            <span className="form-label">Nome do espaço</span>
            <input
              autoComplete="organization"
              className="form-control"
              placeholder="Agência Time"
              {...register('name')}
            />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </label>
          {submitError && <p className="form-alert" role="alert">{submitError}</p>}
          <button className="form-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Criando espaço...' : 'Criar espaço de trabalho'}
          </button>
        </form>
        <button className="text-button workspace-signout" onClick={handleSignOut} type="button">
          <LogOut aria-hidden="true" size={15} />
          Sair da conta
        </button>
      </section>
    </main>
  )
}
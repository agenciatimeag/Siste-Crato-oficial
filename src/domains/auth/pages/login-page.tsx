import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/domains/auth/components/auth-layout'
import { getAuthErrorMessage, useAuth } from '@/domains/auth/auth-context'
import { loginSchema } from '@/domains/auth/auth-schema'
import type { LoginValues } from '@/domains/auth/auth-schema'

export function LoginPage() {
  const { signIn } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: LoginValues) {
    setSubmitError(null)
    try {
      await signIn(values.email, values.password)
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  }

  return (
    <AuthLayout
      title="Entrar no CRATO"
      description="Acesse seu espaço de trabalho."
      footer={<>Ainda não tem uma conta? <Link to="/cadastro">Criar conta</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="form-field">
          <span className="form-label">E-mail</span>
          <input
            autoComplete="email"
            className="form-control"
            inputMode="email"
            placeholder="voce@empresa.com"
            type="email"
            {...register('email')}
          />
          {errors.email && <span className="form-error">{errors.email.message}</span>}
        </label>
        <label className="form-field">
          <span className="form-label">Senha</span>
          <input
            autoComplete="current-password"
            className="form-control"
            type="password"
            {...register('password')}
          />
          {errors.password && <span className="form-error">{errors.password.message}</span>}
        </label>
        {submitError && <p className="form-alert" role="alert">{submitError}</p>}
        <button className="form-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  )
}
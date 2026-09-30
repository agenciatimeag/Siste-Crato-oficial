import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { AuthLayout } from '@/domains/auth/components/auth-layout'
import { getAuthErrorMessage, useAuth } from '@/domains/auth/auth-context'
import { signUpSchema } from '@/domains/auth/auth-schema'
import type { SignUpValues } from '@/domains/auth/auth-schema'

export function SignUpPage() {
  const { signUp } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  })

  async function onSubmit(values: SignUpValues) {
    setSubmitError(null)
    setNotice(null)
    try {
      const requiresEmailConfirmation = await signUp(
        values.fullName,
        values.email,
        values.password,
      )
      if (requiresEmailConfirmation) {
        setNotice('Cadastro criado. Confira seu e-mail para confirmar a conta e entrar.')
      }
    } catch (error) {
      setSubmitError(getAuthErrorMessage(error))
    }
  }

  return (
    <AuthLayout
      title="Criar sua conta"
      description="Use seu e-mail para começar no CRATO."
      footer={<>Já tem uma conta? <Link to="/login">Entrar</Link></>}
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="form-field">
          <span className="form-label">Nome</span>
          <input
            autoComplete="name"
            className="form-control"
            placeholder="Seu nome"
            {...register('fullName')}
          />
          {errors.fullName && <span className="form-error">{errors.fullName.message}</span>}
        </label>
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
            autoComplete="new-password"
            className="form-control"
            type="password"
            {...register('password')}
          />
          {errors.password && <span className="form-error">{errors.password.message}</span>}
        </label>
        {submitError && <p className="form-alert" role="alert">{submitError}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        <button className="form-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>
    </AuthLayout>
  )
}
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
})

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome.'),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
})

export type LoginValues = z.infer<typeof loginSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
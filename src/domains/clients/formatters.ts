export function normalizeCnpj(value: string | null | undefined): string | null {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits || null
}

export function formatCnpj(value: string | null | undefined): string {
  const digits = normalizeCnpj(value)
  if (!digits || digits.length !== 14) return value ?? ''
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export function normalizePhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  return trimmed.startsWith('+') ? `+${digits}` : digits
}

export function isValidPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '')
  return /^\+?[\d\s().-]+$/.test(value) && digits.length >= 8 && digits.length <= 15
}

export function formatPhone(value: string | null | undefined): string {
  const digits = value?.replace(/\D/g, '') ?? ''
  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  }
  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  }
  return value ?? ''
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase('pt-BR') ?? ''
  return normalized || null
}

export function nullableTrimmed(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? ''
  return normalized || null
}
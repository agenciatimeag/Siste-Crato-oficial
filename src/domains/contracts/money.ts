const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function parseBrlToCents(value: string): number {
  const normalized = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)) {
    throw new Error('Informe um valor em reais válido, por exemplo R$ 2.500,00.')
  }

  const negative = normalized.startsWith('-')
  const unsigned = negative ? normalized.slice(1) : normalized
  const [whole, fraction = ''] = unsigned.replace(/\./g, '').split(',')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error('O valor informado excede o limite permitido.')
  return negative ? -cents : cents
}

export function formatCentsToBrl(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error('O valor em centavos precisa ser um inteiro seguro.')
  return currencyFormatter.format(cents / 100)
}
import { describe, expect, it } from 'vitest'
import { billingTermsSchema } from '@/domains/contracts/schemas/billing-terms-schema'
import { contractStatusSchema } from '@/domains/contracts/schemas/contract-schema'
import { calculateContractTerm, isContractOperational } from '@/domains/contracts/contract-term'
import { formatCentsToBrl, parseBrlToCents } from '@/domains/contracts/money'
import { toBillingTermsInsert } from '@/domains/contracts/billing-mapper'

describe('domínio financeiro de contratos', () => {
  it('converte valores localizados em centavos e formata BRL', () => {
    expect(parseBrlToCents('R$ 2.500,00')).toBe(250000)
    expect(parseBrlToCents('0,5')).toBe(50)
    expect(formatCentsToBrl(250000)).toContain('2.500,00')
    expect(() => parseBrlToCents('2,5.00')).toThrow(/valor em reais válido/)
  })

  it('mapeia os modos de cobrança de domínio aos enums reais do banco', () => {
    const recurring = billingTermsSchema.parse({
      mode: 'recurring', recurring_amount_cents: 250000, due_day: 10, first_due_date: '2026-10-10',
    })
    expect(toBillingTermsInsert('workspace-1', 'contract-1', recurring)).toMatchObject({
      billing_mode: 'recurring', recurring_amount_cents: 250000, due_day: 10, currency: 'BRL',
    })

    const upfront = billingTermsSchema.parse({
      mode: 'one_time', total_amount_cents: 250000, first_due_date: '2026-10-10',
    })
    expect(toBillingTermsInsert('workspace-1', 'contract-1', upfront)).toMatchObject({
      billing_mode: 'upfront', total_amount_cents: 250000,
    })

    const installments = billingTermsSchema.parse({
      mode: 'installments', total_amount_cents: 250000, installment_count: 5,
      installment_amount_cents: 50000, first_due_date: '2026-10-10', due_day: 10,
    })
    expect(toBillingTermsInsert('workspace-1', 'contract-1', installments)).toMatchObject({
      billing_mode: 'installment', installment_count: 5, installment_amount_cents: 50000, due_day: 10,
    })
  })

  it('valida condições financeiras de acordo com o modo', () => {
    expect(billingTermsSchema.safeParse({ mode: 'recurring', recurring_amount_cents: 1000, due_day: 32, first_due_date: '2026-10-10' }).success).toBe(false)
    expect(billingTermsSchema.safeParse({ mode: 'installments', total_amount_cents: 1000, installment_count: 0, installment_amount_cents: 250, first_due_date: '2026-10-10' }).success).toBe(false)
  })

  it('calcula dias restantes e níveis de atenção sem persistir valores derivados', () => {
    const today = new Date('2026-06-10T12:00:00Z')
    expect(calculateContractTerm(null, today)).toEqual({ daysRemaining: null, isExpired: false, attention: 'normal' })
    expect(calculateContractTerm('2026-08-09', today)).toMatchObject({ daysRemaining: 60, attention: 'normal', isExpired: false })
    expect(calculateContractTerm('2026-07-11', today)).toMatchObject({ daysRemaining: 31, attention: 'normal' })
    expect(calculateContractTerm('2026-07-10', today).attention).toBe('attention')
    expect(calculateContractTerm('2026-06-18', today)).toMatchObject({ daysRemaining: 8, attention: 'attention' })
    expect(calculateContractTerm('2026-06-17', today).attention).toBe('urgent')
    expect(calculateContractTerm('2026-06-10', today)).toMatchObject({ daysRemaining: 0, attention: 'urgent', isExpired: false })
    expect(calculateContractTerm('2026-06-09', today)).toMatchObject({ daysRemaining: -1, attention: 'expired', isExpired: true })
  })

  it('valida status e identifica contratos operacionais', () => {
    for (const status of ['draft', 'active', 'paused', 'ended', 'cancelled']) {
      expect(contractStatusSchema.safeParse(status).success).toBe(true)
    }
    expect(contractStatusSchema.safeParse('pending').success).toBe(false)
    expect(isContractOperational('active')).toBe(true)
    expect(isContractOperational('ended')).toBe(false)
  })
})
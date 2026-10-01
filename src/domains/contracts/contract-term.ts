import type { ContractStatus, ContractTerm } from '@/domains/contracts/types'

export function calculateContractTerm(endDate: string | null, now = new Date()): ContractTerm {
  if (!endDate) return { daysRemaining: null, isExpired: false, attention: 'normal' }

  const [year, month, day] = endDate.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = [now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate()]
  const endUtc = Date.UTC(year, month - 1, day)
  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay)
  const daysRemaining = Math.floor((endUtc - todayUtc) / 86_400_000)
  const isExpired = daysRemaining < 0

  return {
    daysRemaining,
    isExpired,
    attention: isExpired ? 'expired' : daysRemaining <= 7 ? 'urgent' : daysRemaining <= 30 ? 'attention' : 'normal',
  }
}

export function isContractOperational(status: ContractStatus) {
  return status === 'active' || status === 'paused'
}
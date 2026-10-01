import { DomainError } from '@/domains/shared/domain-error'
import type { OrderedPosition } from '@/domains/workflows/types'

export type ReorderOperation = {
  id: string
  position: number
}

export type ReorderPlan = {
  moveToTemporaryPositions: ReorderOperation[]
  moveToFinalPositions: ReorderOperation[]
}

export function createSafeReorderPlan(items: OrderedPosition[], orderedIds: string[]): ReorderPlan {
  const ids = new Set(items.map(({ id }) => id))
  if (ids.size !== items.length || orderedIds.length !== items.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new DomainError('A nova ordem deve conter cada item exatamente uma vez.', 'INVALID_REORDER')
  }
  if (orderedIds.some((id) => !ids.has(id))) {
    throw new DomainError('A nova ordem contém um item que não pertence a este fluxo.', 'INVALID_REORDER')
  }

  const maxPosition = items.reduce((maximum, item) => Math.max(maximum, item.position), 0)
  if (maxPosition + items.length > 2_147_483_647) {
    throw new DomainError('Não há posições temporárias disponíveis para reordenar este fluxo.', 'POSITION_RANGE_EXCEEDED')
  }
  return {
    moveToTemporaryPositions: orderedIds.map((id, index) => ({ id, position: maxPosition + index + 1 })),
    moveToFinalPositions: orderedIds.map((id, index) => ({ id, position: index + 1 })),
  }
}
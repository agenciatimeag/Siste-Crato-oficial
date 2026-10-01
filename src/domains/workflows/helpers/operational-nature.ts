import type { OperationalNature } from '@/domains/workflows/types'

type StepLike = { operational_nature: OperationalNature }

export const isTodoStep = (step: StepLike) => step.operational_nature === 'todo'
export const isInProgressStep = (step: StepLike) => step.operational_nature === 'in_progress'
export const isWaitingStep = (step: StepLike) => step.operational_nature === 'waiting'
export const isDoneStep = (step: StepLike) => step.operational_nature === 'done'
export const isCompleteStep = (step: StepLike) => step.operational_nature === 'complete'
import { DomainError } from '@/domains/shared/domain-error'

export class WorkflowDomainError extends DomainError {}

export const invalidWorkflowPosition = () => new WorkflowDomainError(
  'Esta etapa não pertence ao fluxo deste tipo de tarefa.',
  'INVALID_WORKFLOW_POSITION',
)

export const workflowNotConfigured = () => new WorkflowDomainError(
  'Este tipo de tarefa ainda não possui um fluxo ativo configurado.',
  'WORKFLOW_NOT_CONFIGURED',
)
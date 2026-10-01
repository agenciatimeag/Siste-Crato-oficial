import { DomainError, mapDatabaseError } from '@/domains/shared/domain-error'

export function mapTaskError(error: unknown): DomainError {
  const databaseError = error as { code?: string; message?: string } | null
  switch (databaseError?.message) {
    case 'INVALID_WORKFLOW_STEP':
    case 'INVALID_WORKFLOW_POSITION':
      return new DomainError('Esta etapa não pertence ao fluxo deste tipo de tarefa.', 'INVALID_WORKFLOW_POSITION', error)
    case 'PARENT_TASK_MUST_SHARE_PROJECT':
      return new DomainError('A subtarefa precisa pertencer ao mesmo projeto da tarefa principal.', 'PARENT_TASK_MUST_SHARE_PROJECT', error)
    case 'TASK_PARENT_CYCLE':
      return new DomainError('Uma tarefa não pode criar um ciclo de subtarefas.', 'TASK_PARENT_CYCLE', error)
    case 'TASK_CANNOT_PARENT_ITSELF':
      return new DomainError('Uma tarefa não pode ser sua própria tarefa principal.', 'TASK_CANNOT_PARENT_ITSELF', error)
    case 'PARENT_TASK_NOT_FOUND':
      return new DomainError('A tarefa principal não foi encontrada neste workspace.', 'PARENT_TASK_NOT_FOUND', error)
    default:
      return mapDatabaseError(error)
  }
}
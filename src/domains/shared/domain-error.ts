export class DomainError extends Error {
  readonly code: string
  readonly cause: unknown

  constructor(message: string, code: string, cause?: unknown) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.cause = cause
  }
}

export function mapDatabaseError(error: unknown): DomainError {
  const databaseError = error as { code?: string; message?: string; constraint?: string } | null
  const constraint = `${databaseError?.constraint ?? ''} ${databaseError?.message ?? ''}`

  if (databaseError?.code === '23505' && constraint.includes('clients_workspace_cnpj_unique')) {
    return new DomainError('Já existe um cliente com este CNPJ.', 'CLIENT_CNPJ_DUPLICATE', error)
  }
  if (databaseError?.code === '23505' && constraint.includes('client_contacts_one_primary_per_client')) {
    return new DomainError('Este cliente já possui outro contato principal.', 'CONTACT_PRIMARY_CONFLICT', error)
  }
  if (databaseError?.code === '23505' && constraint.includes('project_members_project_id_member_id_key')) {
    return new DomainError('Este membro já participa do projeto.', 'PROJECT_MEMBER_DUPLICATE', error)
  }
  if (databaseError?.code === '23505' && constraint.includes('task_type_departments_task_type_id_department_id_key')) {
    return new DomainError('Este departamento já faz parte do fluxo deste tipo de tarefa.', 'TASK_TYPE_DEPARTMENT_DUPLICATE', error)
  }
  if (
    databaseError?.code === '23505'
    && (constraint.includes('task_type_departments_task_type_id_position_key')
      || constraint.includes('workflow_steps_task_type_department_id_position_key'))
  ) {
    return new DomainError('Esta posição já está ocupada neste fluxo.', 'WORKFLOW_POSITION_CONFLICT', error)
  }
  if (databaseError?.code === '23503') {
    return new DomainError('Uma das relações informadas não pertence a este workspace.', 'WORKSPACE_RELATION_INVALID', error)
  }
  if (databaseError?.code === '42501') {
    return new DomainError('Você não tem acesso a este registro neste workspace.', 'WORKSPACE_ACCESS_DENIED', error)
  }

  return new DomainError(
    databaseError?.message ?? 'Ocorreu um erro inesperado ao acessar os dados.',
    databaseError?.code ?? 'DATABASE_ERROR',
    error,
  )
}

export function unwrapResult<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw mapDatabaseError(result.error)
  if (result.data === null) {
    throw new DomainError('O registro solicitado não foi encontrado neste workspace.', 'NOT_FOUND')
  }
  return result.data
}
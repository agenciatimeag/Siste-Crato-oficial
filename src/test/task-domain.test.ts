import { describe, expect, it } from 'vitest'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { getTaskOperationalNature, isTaskComplete } from '@/domains/tasks/helpers/task-state'
import { taskKeys } from '@/domains/tasks/queries/task-keys'
import { taskCreateSchema, taskPriorityValues, taskUpdateSchema } from '@/domains/tasks/schemas/task-schema'
import type { Task } from '@/domains/tasks/types'
import type { WorkflowStep } from '@/domains/workflows/types'

const projectId = 'a3b71d7e-0564-45cb-8ff2-9d7aebbf1ff3'
const taskTypeId = '8ce8dce5-e690-4f28-86b3-327ea393cd2f'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1', workspace_id: 'workspace-1', project_id: projectId, task_type_id: taskTypeId,
    workflow_step_id: 'step-1', parent_task_id: null, title: 'Editar peça', briefing: null,
    final_copy: null, priority: 'low', assignee_member_id: null, reviewer_member_id: null,
    start_date: null, due_date: null, publication_date: null, sort_order: 0, completed_at: null,
    archived_at: null, created_by_member_id: null, created_at: '', updated_at: '',
    ...overrides,
  }
}

function step(nature: WorkflowStep['operational_nature']): WorkflowStep {
  return {
    id: 'step-1', workspace_id: 'workspace-1', task_type_department_id: 'association-1',
    name: 'Finalização', position: 1, operational_nature: nature, is_internal_review: false,
    is_external_review: false, is_revision: false, starts_timesheet: false, stops_timesheet: false,
    estimated_minutes: null, is_active: true, created_at: '', updated_at: '',
  }
}

describe('schema do domínio Task', () => {
  it('exige Projeto, Tipo e título, e aplica prioridade padrão', () => {
    const parsed = taskCreateSchema.parse({ project_id: projectId, task_type_id: taskTypeId, title: ' Revisar arte ' })
    expect(parsed).toMatchObject({ project_id: projectId, task_type_id: taskTypeId, title: 'Revisar arte', priority: 'low' })
    expect(taskCreateSchema.safeParse({ task_type_id: taskTypeId, title: 'Sem projeto' }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ project_id: projectId, task_type_id: taskTypeId, title: '  ' }).success).toBe(false)
    expect(taskPriorityValues).toEqual(['low', 'medium', 'high'])
  })

  it('valida cada data e os limites de entrega/publicação', () => {
    const base = { project_id: projectId, task_type_id: taskTypeId, title: 'Campanha' }
    expect(taskCreateSchema.safeParse({ ...base, start_date: '2026-06-20', due_date: '2026-06-19' }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ ...base, due_date: '2026-06-20', publication_date: '2026-06-19' }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ ...base, start_date: '20/06/2026' }).success).toBe(false)
    expect(taskCreateSchema.safeParse({ ...base, due_date: '2026-06-20', publication_date: '2026-06-21' }).success).toBe(true)
  })

  it('impede client_id, department_id e workflow_step_id em updates genéricos', () => {
    expect(taskUpdateSchema.safeParse({ title: 'Novo título' }).success).toBe(true)
    expect(taskUpdateSchema.safeParse({ client_id: 'client-1' }).success).toBe(false)
    expect(taskUpdateSchema.safeParse({ department_id: 'department-1' }).success).toBe(false)
    expect(taskUpdateSchema.safeParse({ workflow_step_id: 'step-2' }).success).toBe(false)
  })
})

describe('estado derivado de Task', () => {
  it('deriva conclusão exclusivamente de operational_nature complete', () => {
    expect(isTaskComplete(task({ completed_at: '2026-06-01T10:00:00Z' }), step('done'))).toBe(false)
    expect(isTaskComplete(task(), step('complete'))).toBe(true)
    expect(getTaskOperationalNature(task(), step('waiting'))).toBe('waiting')
  })
})

describe('erros conhecidos do banco de Task', () => {
  it('mapeia integridade workflow e regras de parent para erros utilizáveis', () => {
    expect(mapTaskError({ code: '23514', message: 'INVALID_WORKFLOW_POSITION' })).toMatchObject({
      code: 'INVALID_WORKFLOW_POSITION',
      message: 'Esta etapa não pertence ao fluxo deste tipo de tarefa.',
    })
    expect(mapTaskError({ code: '23514', message: 'PARENT_TASK_MUST_SHARE_PROJECT' })).toMatchObject({
      code: 'PARENT_TASK_MUST_SHARE_PROJECT',
      message: 'A subtarefa precisa pertencer ao mesmo projeto da tarefa principal.',
    })
    expect(mapTaskError({ code: '23514', message: 'TASK_PARENT_CYCLE' })).toMatchObject({
      code: 'TASK_PARENT_CYCLE',
      message: 'Uma tarefa não pode criar um ciclo de subtarefas.',
    })
    expect(mapTaskError({ code: 'XX000', message: 'falha desconhecida' }).message).toBe('falha desconhecida')
  })
})

describe('query keys de Task', () => {
  it('escopa listas, detalhes, subtarefas e atividade pelo workspace', () => {
    expect(taskKeys.list('workspace-1', { projectId })).toEqual(['tasks', 'workspace-1', 'list', { projectId }])
    expect(taskKeys.detail('workspace-1', 'task-1')).toEqual(['tasks', 'workspace-1', 'detail', 'task-1'])
    expect(taskKeys.project('workspace-1', projectId)).toEqual(['tasks', 'workspace-1', 'project', projectId, {}])
    expect(taskKeys.assignee('workspace-1', 'member-1')).toEqual(['tasks', 'workspace-1', 'assignee', 'member-1', {}])
    expect(taskKeys.reviewer('workspace-1', 'member-2')).toEqual(['tasks', 'workspace-1', 'reviewer', 'member-2', {}])
    expect(taskKeys.taskType('workspace-1', taskTypeId)).toEqual(['tasks', 'workspace-1', 'task-type', taskTypeId, {}])
    expect(taskKeys.workflowStep('workspace-1', 'step-1')).toEqual(['tasks', 'workspace-1', 'workflow-step', 'step-1', {}])
    expect(taskKeys.subtasks('workspace-1', 'task-1')).toEqual(['tasks', 'workspace-1', 'subtasks', 'task-1', false])
    expect(taskKeys.activity('workspace-1', 'task-1')).toEqual(['tasks', 'workspace-1', 'activity', 'task-1'])
  })
})
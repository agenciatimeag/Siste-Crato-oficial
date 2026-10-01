import { describe, expect, it } from 'vitest'
import { departmentSchema } from '@/domains/workflows/schemas/department-schema'
import { taskTypeSchema } from '@/domains/workflows/schemas/task-type-schema'
import { operationalNatureSchema, workflowStepUpdateSchema } from '@/domains/workflows/schemas/workflow-step-schema'
import { getDepartmentsForTaskTypeFromWorkflow, getFirstDepartmentFromWorkflow, getFirstStepForDepartmentFromWorkflow, getFirstStepFromWorkflow, getStepsForDepartmentFromWorkflow, resolveTaskTypeChangeFromWorkflow, resolveWorkflowPositionFromWorkflow, validateWorkflowPositionInWorkflow } from '@/domains/workflows/helpers/workflow-resolution'
import { createSafeReorderPlan } from '@/domains/workflows/helpers/position-order'
import { workflowKeys } from '@/domains/workflows/queries/workflow-keys'
import { isCompleteStep, isDoneStep, isInProgressStep, isTodoStep, isWaitingStep } from '@/domains/workflows/helpers/operational-nature'
import type { Department, TaskType, TaskTypeDepartment, TaskTypeWorkflow, WorkflowStep } from '@/domains/workflows/types'

function taskType(id: string, name: string, isActive = true): TaskType {
  return { id, workspace_id: 'workspace-1', name, description: null, is_active: isActive, created_at: '', updated_at: '' }
}

function department(id: string, name: string, isActive = true): Department {
  return { id, workspace_id: 'workspace-1', name, description: null, is_active: isActive, created_at: '', updated_at: '' }
}

function association(id: string, taskTypeId: string, departmentId: string, position: number, isActive = true): TaskTypeDepartment {
  return {
    id, workspace_id: 'workspace-1', task_type_id: taskTypeId, department_id: departmentId,
    position, is_active: isActive, created_at: '', updated_at: '',
  }
}

function step(id: string, associationId: string, name: string, position: number, nature: WorkflowStep['operational_nature'] = 'todo', isActive = true): WorkflowStep {
  return {
    id, workspace_id: 'workspace-1', task_type_department_id: associationId, name, position,
    operational_nature: nature, is_internal_review: false, is_external_review: false,
    is_revision: false, starts_timesheet: false, stops_timesheet: false,
    estimated_minutes: null, is_active: isActive, created_at: '', updated_at: '',
  }
}

const planningDepartment = department('department-planning', 'Planejamento')
const creativeDepartment = department('department-creative', 'Criação')
const videoPlanning = association('video-planning', 'type-video', planningDepartment.id, 1)
const videoCreative = association('video-creative', 'type-video', creativeDepartment.id, 2)
const sitePlanning = association('site-planning', 'type-site', planningDepartment.id, 1)
const siteCreative = association('site-creative', 'type-site', creativeDepartment.id, 2)
const videoBrief = step('video-brief', videoPlanning.id, 'Briefing', 2, 'in_progress')
const videoPlan = step('video-plan', videoPlanning.id, 'Planejar', 1)
const videoEdit = step('video-edit', videoCreative.id, 'Editar', 2, 'in_progress')
const videoScript = step('video-script', videoCreative.id, 'Roteirizar', 1)
const siteStructure = step('site-structure', sitePlanning.id, 'Estrutura', 1)
const siteWireframe = step('site-wireframe', siteCreative.id, 'Wireframe', 1)

const videoWorkflow: TaskTypeWorkflow = {
  taskType: taskType('type-video', 'Vídeo'),
  departments: [
    { association: videoCreative, department: creativeDepartment, steps: [videoEdit, videoScript] },
    { association: videoPlanning, department: planningDepartment, steps: [videoBrief, videoPlan] },
  ],
}

const siteWorkflow: TaskTypeWorkflow = {
  taskType: taskType('type-site', 'Site'),
  departments: [
    { association: siteCreative, department: creativeDepartment, steps: [siteWireframe] },
    { association: sitePlanning, department: planningDepartment, steps: [siteStructure] },
  ],
}

describe('schemas do motor de workflow', () => {
  it('suporta tipos e departamentos ativos/inativos sem acoplar departamentos a etapas universais', () => {
    expect(taskTypeSchema.parse({ name: 'Vídeo' }).is_active).toBe(true)
    expect(taskTypeSchema.parse({ name: 'Vídeo', is_active: false }).is_active).toBe(false)
    expect(departmentSchema.parse({ name: 'Criação' }).is_active).toBe(true)
    expect(departmentSchema.parse({ name: 'Criação', is_active: false }).is_active).toBe(false)
  })

  it('organiza query keys por workspace, Tipo, associação e modo activeOnly', () => {
    expect(workflowKeys.taskTypes('workspace-1', true)).toEqual([
      'workflows', 'task-types', 'workspace-1', true,
    ])
    expect(workflowKeys.flow('workspace-1', 'type-video', false)).toEqual([
      'workflows', 'flow', 'workspace-1', 'type-video', false,
    ])
    expect(workflowKeys.steps('workspace-1', 'video-creative', true)).toEqual([
      'workflows', 'steps', 'workspace-1', 'video-creative', true,
    ])
  })

  it('valida naturezas operacionais e impede trocar o vínculo de uma etapa via update', () => {
    for (const nature of ['todo', 'in_progress', 'waiting', 'done', 'complete']) {
      expect(operationalNatureSchema.safeParse(nature).success).toBe(true)
    }
    expect(operationalNatureSchema.safeParse('editing').success).toBe(false)
    expect(workflowStepUpdateSchema.safeParse({
      task_type_department_id: 'other-context',
      name: 'Etapa',
    }).success).toBe(false)
  })
})

describe('resolução hierárquica do fluxo', () => {
  it('ordena departamentos e etapas por position, não alfabeticamente', () => {
    expect(getDepartmentsForTaskTypeFromWorkflow(videoWorkflow).map(({ department }) => department.name))
      .toEqual(['Planejamento', 'Criação'])
    expect(getStepsForDepartmentFromWorkflow(videoWorkflow, planningDepartment.id).map(({ name }) => name))
      .toEqual(['Planejar', 'Briefing'])
    expect(getStepsForDepartmentFromWorkflow(videoWorkflow, videoCreative.department_id).map(({ name }) => name))
      .toEqual(['Roteirizar', 'Editar'])
  })

  it('permite o mesmo Departamento em Tipos com etapas independentes', () => {
    expect(getStepsForDepartmentFromWorkflow(videoWorkflow, creativeDepartment.id).map(({ name }) => name))
      .toEqual(['Roteirizar', 'Editar'])
    expect(getStepsForDepartmentFromWorkflow(siteWorkflow, creativeDepartment.id).map(({ name }) => name))
      .toEqual(['Wireframe'])
  })

  it('rejeita etapa que pertence a outro Tipo de Tarefa', () => {
    expect(() => validateWorkflowPositionInWorkflow(videoWorkflow, {
      taskTypeId: videoWorkflow.taskType.id,
      workflowStepId: siteWireframe.id,
    })).toThrow(expect.objectContaining({ code: 'INVALID_WORKFLOW_POSITION' }))
  })

  it('resolve primeiro departamento e primeira etapa ativa pela posição', () => {
    expect(getFirstDepartmentFromWorkflow(videoWorkflow).department.name).toBe('Planejamento')
    expect(getFirstStepFromWorkflow(videoWorkflow).workflowStep.name).toBe('Planejar')
    expect(getFirstStepForDepartmentFromWorkflow(videoWorkflow, creativeDepartment.id).workflowStep.name)
      .toBe('Roteirizar')
  })

  it('preserva posição válida ao manter o Tipo e resolve nova primeira etapa quando inválida', () => {
    expect(resolveTaskTypeChangeFromWorkflow(siteWorkflow, siteWireframe.id).workflowStep.id)
      .toBe(siteWireframe.id)
    expect(resolveTaskTypeChangeFromWorkflow(siteWorkflow, videoEdit.id).workflowStep.id)
      .toBe(siteStructure.id)
  })

  it('falha explicitamente quando o Tipo não tem fluxo configurado', () => {
    const emptyWorkflow = { ...siteWorkflow, departments: [] }
    expect(() => getFirstStepFromWorkflow(emptyWorkflow))
      .toThrow(expect.objectContaining({ code: 'WORKFLOW_NOT_CONFIGURED' }))
  })

  it('valida departamento e etapa explícitos na mudança de departamento', () => {
    expect(resolveWorkflowPositionFromWorkflow(videoWorkflow, {
      taskTypeId: 'type-video', departmentId: creativeDepartment.id,
    }).workflowStep.name).toBe('Roteirizar')
    expect(() => resolveWorkflowPositionFromWorkflow(videoWorkflow, {
      taskTypeId: 'type-video', departmentId: 'department-development',
    })).toThrow(expect.objectContaining({ code: 'DEPARTMENT_NOT_IN_TASK_TYPE' }))
    expect(() => resolveWorkflowPositionFromWorkflow(videoWorkflow, {
      taskTypeId: 'type-video', departmentId: planningDepartment.id, workflowStepId: videoEdit.id,
    })).toThrow(expect.objectContaining({ code: 'INVALID_WORKFLOW_POSITION' }))
  })

  it('centraliza a natureza operacional sem depender do nome da etapa', () => {
    expect(isTodoStep(step('a', 'b', 'Aguardando cliente', 1, 'todo'))).toBe(true)
    expect(isInProgressStep(step('a', 'b', 'Revisão interna', 1, 'in_progress'))).toBe(true)
    expect(isWaitingStep(step('a', 'b', 'Editar', 1, 'waiting'))).toBe(true)
    expect(isDoneStep(step('a', 'b', 'Finalizado', 1, 'done'))).toBe(true)
    expect(isCompleteStep(step('a', 'b', 'Concluído', 1, 'complete'))).toBe(true)
  })

  it('exclui inativos das opções operacionais, mantendo-os disponíveis para configuração', () => {
    const inactiveStep = step('video-inactive', videoCreative.id, 'Rascunho antigo', 3, 'todo', false)
    const inactiveDepartment = {
      ...videoWorkflow.departments[0],
      association: { ...videoCreative, is_active: false },
      steps: [...videoWorkflow.departments[0].steps, inactiveStep],
    }
    const workflowWithInactive: TaskTypeWorkflow = {
      ...videoWorkflow,
      departments: [
        inactiveDepartment,
        videoWorkflow.departments[1],
      ],
    }
    expect(getDepartmentsForTaskTypeFromWorkflow(workflowWithInactive).map(({ department }) => department.id))
      .toEqual([planningDepartment.id])
    expect(getDepartmentsForTaskTypeFromWorkflow(workflowWithInactive, false)).toHaveLength(2)
    expect(getStepsForDepartmentFromWorkflow(workflowWithInactive, creativeDepartment.id, false))
      .toContainEqual(inactiveStep)
    expect(getStepsForDepartmentFromWorkflow(workflowWithInactive, creativeDepartment.id))
      .not.toContainEqual(inactiveStep)
  })
})

describe('reordenação sem colisão', () => {
  it('usa posições temporárias positivas acima do máximo antes das posições finais', () => {
    const plan = createSafeReorderPlan([
      { id: 'first', position: 1 },
      { id: 'second', position: 2 },
    ], ['second', 'first'])

    expect(plan.moveToTemporaryPositions).toEqual([
      { id: 'second', position: 3 },
      { id: 'first', position: 4 },
    ])
    expect(plan.moveToFinalPositions).toEqual([
      { id: 'second', position: 1 },
      { id: 'first', position: 2 },
    ])
    expect(plan.moveToTemporaryPositions.every(({ position }) => position > 0)).toBe(true)
  })

  it('rejeita ordens incompletas, duplicadas ou com itens externos', () => {
    const items = [{ id: 'first', position: 1 }, { id: 'second', position: 2 }]
    expect(() => createSafeReorderPlan(items, ['first'])).toThrow(expect.objectContaining({ code: 'INVALID_REORDER' }))
    expect(() => createSafeReorderPlan(items, ['first', 'first'])).toThrow(expect.objectContaining({ code: 'INVALID_REORDER' }))
    expect(() => createSafeReorderPlan(items, ['first', 'other'])).toThrow(expect.objectContaining({ code: 'INVALID_REORDER' }))
  })
})
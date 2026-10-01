import { z } from 'zod'

const taskPrioritySchema = z.enum(['low', 'medium', 'high'])

function dateField(label: string) {
  return z.string().nullish().transform((value) => value ?? null)
    .refine((value) => value === null || z.iso.date().safeParse(value).success, `Informe uma ${label} válida.`)
}

function validateTaskDates(
  task: { start_date?: string | null; execution_date?: string | null; due_date?: string | null; publication_date?: string | null },
  context: z.RefinementCtx,
) {
  if (task.start_date && task.execution_date && task.execution_date < task.start_date) {
    context.addIssue({ code: 'custom', path: ['execution_date'], message: 'A data de execução não pode ser anterior ao início.' })
  }
  if (task.execution_date && task.due_date && task.due_date < task.execution_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'A data de entrega não pode ser anterior à execução.' })
  }
  if (task.start_date && task.due_date && task.due_date < task.start_date) {
    context.addIssue({ code: 'custom', path: ['due_date'], message: 'A data de entrega não pode ser anterior ao início.' })
  }
  if (task.due_date && task.publication_date && task.publication_date < task.due_date) {
    context.addIssue({ code: 'custom', path: ['publication_date'], message: 'A data de publicação não pode ser anterior à entrega.' })
  }
}

export const taskCreateSchema = z.object({
  project_id: z.string().uuid('Selecione um projeto válido.'),
  task_type_id: z.string().uuid('Selecione um tipo de tarefa válido.'),
  workflow_step_id: z.string().uuid().nullish().transform((value) => value ?? null),
  department_id: z.string().uuid('Selecione um departamento válido.').nullish().transform((value) => value ?? null),
  parent_task_id: z.string().uuid().nullish().transform((value) => value ?? null),
  sprint_id: z.string().uuid().nullish().transform((value) => value ?? null),
  title: z.string().trim().min(1, 'Informe o título da tarefa.').max(500),
  briefing: z.string().trim().max(50000).nullish().transform((value) => value ?? null),
  final_copy: z.string().trim().max(50000).nullish().transform((value) => value ?? null),
  priority: taskPrioritySchema.default('low'),
  assignee_member_id: z.string().uuid().nullish().transform((value) => value ?? null),
  reviewer_member_id: z.string().uuid().nullish().transform((value) => value ?? null),
  start_date: dateField('data de início'),
  execution_date: dateField('data de execução'),
  due_date: dateField('data de entrega'),
  publication_date: dateField('data de publicação'),
  sort_order: z.number().int().safe().optional(),
}).superRefine(validateTaskDates).strict()

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  briefing: z.string().trim().max(50000).nullish().optional(),
  final_copy: z.string().trim().max(50000).nullish().optional(),
  priority: taskPrioritySchema.optional(),
  assignee_member_id: z.string().uuid().nullish().optional(),
  reviewer_member_id: z.string().uuid().nullish().optional(),
  start_date: dateField('data de início').optional(),
  execution_date: dateField('data de execução').optional(),
  due_date: dateField('data de entrega').optional(),
  publication_date: dateField('data de publicação').optional(),
  sort_order: z.number().int().safe().optional(),
}).superRefine(validateTaskDates).strict()

export const taskPriorityValues = taskPrioritySchema.options
import { z } from 'zod'

export const operationalNatureSchema = z.enum(['todo', 'in_progress', 'waiting', 'done', 'complete'])

export const workflowStepSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome da etapa.').max(180),
  position: z.number().int().positive(),
  operational_nature: operationalNatureSchema.default('todo'),
  is_internal_review: z.boolean().default(false),
  is_external_review: z.boolean().default(false),
  is_revision: z.boolean().default(false),
  starts_timesheet: z.boolean().default(false),
  stops_timesheet: z.boolean().default(false),
  estimated_minutes: z.number().int().nonnegative().nullish().transform((value) => value ?? null),
  is_active: z.boolean().default(true),
}).strict()

export const workflowStepUpdateSchema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  position: z.number().int().positive().optional(),
  operational_nature: operationalNatureSchema.optional(),
  is_internal_review: z.boolean().optional(),
  is_external_review: z.boolean().optional(),
  is_revision: z.boolean().optional(),
  starts_timesheet: z.boolean().optional(),
  stops_timesheet: z.boolean().optional(),
  estimated_minutes: z.number().int().nonnegative().nullish().optional(),
  is_active: z.boolean().optional(),
}).strict()
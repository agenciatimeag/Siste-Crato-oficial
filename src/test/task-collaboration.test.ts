import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChecklistItem, deleteChecklistItem, reorderChecklistItems, toggleChecklistItem, updateChecklistItem } from '@/domains/tasks/services/checklist-service'
import { createTaskComment, deleteTaskComment, replyToTaskComment, updateTaskComment } from '@/domains/tasks/services/task-comment-service'
import { createTaskFileMetadata, deleteTaskFileMetadata, listTaskFinalDeliveryFiles } from '@/domains/tasks/services/task-file-service'
import { createSavedView, deleteSavedView, listSavedViews, setDefaultSavedView, updateSavedView } from '@/domains/tasks/services/task-saved-view-service'
import type { Database } from '@/lib/supabase/database.types'
import type { Task, TaskChecklistItem, TaskComment, TaskFile, TaskSavedView } from '@/domains/tasks/types'

const { collaborationMocks } = vi.hoisted(() => ({
  collaborationMocks: {
    getTask: vi.fn(),
    recordActivity: vi.fn(),
  },
}))

vi.mock('@/domains/tasks/queries/task-query-service', () => ({ getTask: collaborationMocks.getTask }))
vi.mock('@/domains/activity/activity-service', () => ({ recordActivity: collaborationMocks.recordActivity }))

const workspaceId = 'workspace-1'
const taskId = '45ed92e0-f3d9-4c10-8eb8-b7c70a59f056'
const otherTaskId = '2ce7fbe7-d5f2-4fc6-9b6d-5a5574d5ca61'
const memberId = '94e3c694-f2af-466b-ac3c-d9b84c5b27c4'
const itemId = 'b8f3b2f7-8178-4d50-a26c-06ee35f2ce01'
const commentId = '3f9c244f-f630-45d1-a446-e9245ef34d9b'
const viewId = '16f67c23-1e8d-49d2-9d2f-20d123456789'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: taskId, workspace_id: workspaceId, project_id: 'project-1', task_type_id: 'type-1', workflow_step_id: 'step-1',
    parent_task_id: null, task_number: 1847, sprint_id: null, title: 'Campanha', briefing: null, final_copy: null,
    priority: 'medium', assignee_member_id: null, reviewer_member_id: null, start_date: null, execution_date: null,
    due_date: null, publication_date: null, sort_order: 0, completed_at: null, archived_at: null,
    created_by_member_id: memberId, created_at: '', updated_at: '', ...overrides,
  }
}

function checklistItem(overrides: Partial<TaskChecklistItem> = {}): TaskChecklistItem {
  return {
    id: itemId, workspace_id: workspaceId, task_id: taskId, title: 'Revisar briefing', position: 1,
    is_completed: false, completed_at: null, created_by_member_id: memberId, completed_by_member_id: null,
    created_at: '', updated_at: '', ...overrides,
  }
}

function comment(overrides: Partial<TaskComment> = {}): TaskComment {
  return {
    id: commentId, workspace_id: workspaceId, task_id: taskId, author_member_id: memberId, body: 'Comentário',
    reply_to_comment_id: null, created_at: '', updated_at: '', deleted_at: null, ...overrides,
  }
}

function file(overrides: Partial<TaskFile> = {}): TaskFile {
  return {
    id: 'file-1', workspace_id: workspaceId, task_id: taskId, comment_id: null, kind: 'attachment', file_name: 'arte.pdf',
    mime_type: 'application/pdf', size_bytes: 100, storage_path: null, created_by_member_id: memberId, created_at: '', ...overrides,
  }
}

function savedView(overrides: Partial<TaskSavedView> = {}): TaskSavedView {
  return {
    id: viewId, workspace_id: workspaceId, member_id: memberId, name: 'Minhas tarefas', view_type: 'list',
    settings: {}, is_default: false, created_at: '', updated_at: '', ...overrides,
  }
}

function fluentQuery(response: unknown, inserts: unknown[] = [], updates: unknown[] = []) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const query: Record<string, unknown> = {}
  const chain = (method: string) => vi.fn((...args: unknown[]) => {
    calls.push({ method, args })
    return query
  })
  for (const method of ['select', 'eq', 'order', 'limit']) query[method] = chain(method)
  query.insert = vi.fn((values: unknown) => {
    inserts.push(values)
    return query
  })
  query.update = vi.fn((values: unknown) => {
    updates.push(values)
    return query
  })
  query.delete = vi.fn(() => query)
  query.single = vi.fn(async () => response)
  query.maybeSingle = vi.fn(async () => response)
  query.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(response).then(resolve, reject)
  return { query, calls }
}

function mockClient(queries: Record<string, ReturnType<typeof fluentQuery>[]>) {
  return {
    from: vi.fn((table: string) => {
      const next = queries[table]?.shift()
      if (!next) throw new Error(`Consulta inesperada para ${table}`)
      return next.query
    }),
  } as unknown as SupabaseClient<Database>
}

function activeMemberQuery() {
  return fluentQuery({ data: { id: memberId }, error: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  collaborationMocks.getTask.mockResolvedValue(task())
  collaborationMocks.recordActivity.mockResolvedValue(undefined)
})

describe('Checklist de Task', () => {
  it('cria, edita, completa, reabre e exclui itens com activity relevante', async () => {
    const inserted: unknown[] = []
    const updates: unknown[] = []
    const created = checklistItem()
    const completed = checklistItem({ is_completed: true, completed_at: '2026-10-01T10:00:00.000Z', completed_by_member_id: memberId })
    const reopened = checklistItem()
    const client = mockClient({
      workspace_members: [activeMemberQuery(), activeMemberQuery()],
      task_checklist_items: [
        fluentQuery({ data: null, error: null }),
        fluentQuery({ data: created, error: null }, inserted),
        fluentQuery({ data: { ...created, title: 'Novo título' }, error: null }, [], updates),
        fluentQuery({ data: created, error: null }), fluentQuery({ data: completed, error: null }, [], updates),
        fluentQuery({ data: completed, error: null }), fluentQuery({ data: reopened, error: null }, [], updates),
        fluentQuery({ data: reopened, error: null }), fluentQuery({ error: null }),
      ],
    })

    await expect(createChecklistItem(workspaceId, taskId, { title: ' Revisar briefing ' }, memberId, client)).resolves.toEqual(created)
    await expect(updateChecklistItem(workspaceId, itemId, { title: 'Novo título' }, client)).resolves.toMatchObject({ title: 'Novo título' })
    await expect(toggleChecklistItem(workspaceId, itemId, true, memberId, client)).resolves.toEqual(completed)
    await expect(toggleChecklistItem(workspaceId, itemId, false, memberId, client)).resolves.toEqual(reopened)
    await expect(deleteChecklistItem(workspaceId, itemId, memberId, client)).resolves.toBeUndefined()
    expect(inserted[0]).toMatchObject({ workspace_id: workspaceId, task_id: taskId, title: 'Revisar briefing', position: 1 })
    expect(updates).toContainEqual({ is_completed: false, completed_at: null, completed_by_member_id: null })
    expect(collaborationMocks.recordActivity.mock.calls.map(([input]) => input.action)).toEqual([
      'task.checklist_created', 'task.checklist_completed', 'task.checklist_reopened', 'task.checklist_deleted',
    ])
  })

  it('rejeita título vazio, item externo e reordena todos os itens sem colisão de posição', async () => {
    const invalidClient = mockClient({})
    await expect(createChecklistItem(workspaceId, taskId, { title: ' ' }, null, invalidClient)).rejects.toMatchObject({ name: 'ZodError' })

    const externalClient = mockClient({ task_checklist_items: [fluentQuery({ data: null, error: null })] })
    await expect(updateChecklistItem(workspaceId, itemId, { title: 'Novo' }, externalClient)).rejects.toMatchObject({ code: 'CHECKLIST_ITEM_NOT_FOUND' })

    const second = checklistItem({ id: 'dca0ef24-dba1-4ec4-a465-964bca78b9ed', position: 2 })
    const updates: unknown[] = []
    const reorderClient = mockClient({
      task_checklist_items: [
        fluentQuery({ data: [checklistItem(), second], error: null }),
        fluentQuery({ error: null }, [], updates), fluentQuery({ error: null }, [], updates),
        fluentQuery({ error: null }, [], updates), fluentQuery({ error: null }, [], updates),
      ],
    })
    await expect(reorderChecklistItems(workspaceId, taskId, [second.id, itemId], reorderClient)).resolves.toMatchObject([
      { id: second.id, position: 1 }, { id: itemId, position: 2 },
    ])
    expect(updates).toEqual([{ position: 5 }, { position: 6 }, { position: 1 }, { position: 2 }])
  })
})

describe('Comments de Task', () => {
  it('cria, edita e exclui comentário por soft delete', async () => {
    const updates: unknown[] = []
    const created = comment()
    const deleted = comment({ deleted_at: '2026-10-01T10:00:00.000Z' })
    const client = mockClient({
      workspace_members: [activeMemberQuery(), activeMemberQuery(), activeMemberQuery()],
      task_comments: [
        fluentQuery({ data: created, error: null }),
        fluentQuery({ data: created, error: null }), fluentQuery({ data: { ...created, body: 'Editado' }, error: null }, [], updates),
        fluentQuery({ data: created, error: null }), fluentQuery({ data: deleted, error: null }, [], updates),
      ],
    })
    await expect(createTaskComment(workspaceId, taskId, { body: ' Comentário ' }, memberId, client)).resolves.toEqual(created)
    await expect(updateTaskComment(workspaceId, commentId, { body: 'Editado' }, memberId, client)).resolves.toMatchObject({ body: 'Editado' })
    await expect(deleteTaskComment(workspaceId, commentId, memberId, client)).resolves.toEqual(deleted)
    expect(updates[1]).toMatchObject({ deleted_at: expect.any(String) })
    expect(collaborationMocks.recordActivity.mock.calls.map(([input]) => input.action)).toEqual([
      'task.comment_created', 'task.comment_edited', 'task.comment_deleted',
    ])
  })

  it('aceita resposta da mesma Task e rejeita autor, corpo ou reply inválidos', async () => {
    const created = comment({ id: 'reply-1', reply_to_comment_id: commentId })
    const client = mockClient({
      workspace_members: [activeMemberQuery()],
      task_comments: [fluentQuery({ data: comment(), error: null }), fluentQuery({ data: created, error: null })],
    })
    await expect(replyToTaskComment(workspaceId, taskId, commentId, 'Resposta', memberId, client)).resolves.toEqual(created)

    const invalidAuthor = mockClient({ workspace_members: [fluentQuery({ data: null, error: null })] })
    await expect(createTaskComment(workspaceId, taskId, { body: 'Novo' }, memberId, invalidAuthor)).rejects.toMatchObject({ code: 'WORKSPACE_MEMBER_NOT_ACTIVE' })
    await expect(createTaskComment(workspaceId, taskId, { body: ' ' }, memberId, invalidAuthor)).rejects.toMatchObject({ name: 'ZodError' })

    const crossTask = mockClient({
      workspace_members: [activeMemberQuery()],
      task_comments: [fluentQuery({ data: comment({ task_id: otherTaskId }), error: null })],
    })
    await expect(replyToTaskComment(workspaceId, taskId, commentId, 'Resposta', memberId, crossTask))
      .rejects.toMatchObject({ code: 'TASK_COMMENT_REPLY_TASK_MISMATCH' })

    const externalComment = mockClient({ task_comments: [fluentQuery({ data: null, error: null })] })
    await expect(updateTaskComment(workspaceId, 'comment-external', { body: 'Novo texto' }, memberId, externalComment))
      .rejects.toMatchObject({ code: 'TASK_COMMENT_NOT_FOUND' })
  })
})

describe('Files de Task', () => {
  it('registra attachment e final_delivery sem upload e filtra arquivos finais', async () => {
    const inserted: unknown[] = []
    const attachment = file()
    const delivery = file({ id: 'file-2', kind: 'final_delivery', file_name: 'entrega.zip' })
    const listQuery = fluentQuery({ data: [delivery], error: null })
    const client = mockClient({
      workspace_members: [activeMemberQuery(), activeMemberQuery()],
      task_files: [fluentQuery({ data: attachment, error: null }, inserted), fluentQuery({ data: delivery, error: null }, inserted), listQuery],
    })
    await expect(createTaskFileMetadata(workspaceId, taskId, { kind: 'attachment', file_name: 'arte.pdf' }, memberId, client)).resolves.toEqual(attachment)
    await expect(createTaskFileMetadata(workspaceId, taskId, { kind: 'final_delivery', file_name: 'entrega.zip', storage_path: null }, memberId, client)).resolves.toEqual(delivery)
    await expect(listTaskFinalDeliveryFiles(workspaceId, taskId, client)).resolves.toEqual([delivery])
    expect(inserted).toHaveLength(2)
    expect(listQuery.calls).toContainEqual({ method: 'eq', args: ['kind', 'final_delivery'] })
  })

  it('valida anexos de comentário, tamanho e isolamento de workspace', async () => {
    const invalidClient = mockClient({})
    await expect(createTaskFileMetadata(workspaceId, taskId, { kind: 'attachment', file_name: 'x', size_bytes: -1 }, null, invalidClient))
      .rejects.toMatchObject({ name: 'ZodError' })
    await expect(createTaskFileMetadata(workspaceId, taskId, { kind: 'invalid' as never, file_name: 'x' }, null, invalidClient))
      .rejects.toMatchObject({ name: 'ZodError' })

    const invalidComment = mockClient({ task_comments: [fluentQuery({ data: comment({ task_id: otherTaskId }), error: null })] })
    await expect(createTaskFileMetadata(workspaceId, taskId, {
      kind: 'comment_attachment', file_name: 'anexo.png', comment_id: commentId,
    }, null, invalidComment)).rejects.toMatchObject({ code: 'TASK_FILE_COMMENT_TASK_MISMATCH' })

    const externalFile = mockClient({ task_files: [fluentQuery({ data: null, error: null })] })
    await expect(deleteTaskFileMetadata(workspaceId, 'file-external', null, externalFile)).rejects.toMatchObject({ code: 'TASK_FILE_NOT_FOUND' })
  })
})

describe('Saved Views de Task', () => {
  it('lista, cria, atualiza e exclui visualizações tipadas por membro', async () => {
    const created = savedView()
    const updated = savedView({ name: 'Priorizadas', settings: { grouping: 'priority' } })
    const client = mockClient({
      workspace_members: [activeMemberQuery(), activeMemberQuery()],
      task_saved_views: [
        fluentQuery({ data: [created], error: null }),
        fluentQuery({ data: created, error: null }),
        fluentQuery({ data: created, error: null }), fluentQuery({ data: updated, error: null }),
        fluentQuery({ data: updated, error: null }), fluentQuery({ error: null }),
      ],
    })
    await expect(listSavedViews(workspaceId, memberId, client)).resolves.toEqual([created])
    await expect(createSavedView(workspaceId, memberId, { name: 'Minhas tarefas', view_type: 'list', settings: { includeArchived: false } }, client)).resolves.toEqual(created)
    await expect(updateSavedView(workspaceId, memberId, viewId, { name: 'Priorizadas', settings: { grouping: 'priority' } }, client)).resolves.toEqual(updated)
    await expect(deleteSavedView(workspaceId, memberId, viewId, client)).resolves.toBeUndefined()
  })

  it('substitui default apenas para o mesmo membro e tipo de visualização', async () => {
    const target = savedView({ id: 'view-new', view_type: 'list', is_default: false })
    const previous = savedView({ id: viewId, view_type: 'list', is_default: true })
    const targetQuery = fluentQuery({ data: target, error: null })
    const defaultQuery = fluentQuery({ data: { id: previous.id }, error: null })
    const client = mockClient({
      task_saved_views: [
        targetQuery,
        defaultQuery,
        fluentQuery({ error: null }),
        fluentQuery({ data: { ...target, is_default: true }, error: null }),
      ],
    })
    await expect(setDefaultSavedView(workspaceId, memberId, target.id, client)).resolves.toMatchObject({ is_default: true })
    for (const query of [targetQuery, defaultQuery]) {
      expect(query.calls).toContainEqual({ method: 'eq', args: ['workspace_id', workspaceId] })
      expect(query.calls).toContainEqual({ method: 'eq', args: ['member_id', memberId] })
    }
    expect(defaultQuery.calls).toContainEqual({ method: 'eq', args: ['view_type', 'list'] })

    const externalMember = mockClient({ workspace_members: [fluentQuery({ data: null, error: null })] })
    await expect(listSavedViews(workspaceId, 'member-from-another-workspace', externalMember))
      .rejects.toMatchObject({ code: 'WORKSPACE_MEMBER_NOT_ACTIVE' })
  })
})
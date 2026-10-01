import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { DomainError } from '@/domains/shared/domain-error'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { taskCommentCreateSchema, taskCommentUpdateSchema } from '@/domains/tasks/schemas/task-comment-schema'
import { recordTaskActivity, requireTaskInWorkspace, requireTaskMember } from '@/domains/tasks/services/task-collaboration-service'
import type { TaskComment } from '@/domains/tasks/types'
import { supabase } from '@/lib/supabase/client'

export async function getTaskComment(
  workspaceId: string,
  commentId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskComment> {
  const { data, error } = await client.from('task_comments').select('*')
    .eq('workspace_id', workspaceId).eq('id', commentId).maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Comentário não encontrado neste workspace.', 'TASK_COMMENT_NOT_FOUND')
  return data
}

export async function listTaskComments(
  workspaceId: string,
  taskId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskComment[]> {
  await requireTaskInWorkspace(workspaceId, taskId, client)
  const { data, error } = await client.from('task_comments').select('*')
    .eq('workspace_id', workspaceId).eq('task_id', taskId).order('created_at')
  if (error) throw mapTaskError(error)
  return data ?? []
}

export async function createTaskComment(
  workspaceId: string,
  taskId: string,
  input: { body: string; reply_to_comment_id?: string | null },
  authorMemberId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskComment> {
  const values = taskCommentCreateSchema.parse(input)
  await requireTaskInWorkspace(workspaceId, taskId, client)
  await requireTaskMember(workspaceId, authorMemberId, client)
  if (values.reply_to_comment_id) {
    const replyTarget = await getTaskComment(workspaceId, values.reply_to_comment_id, client)
    if (replyTarget.task_id !== taskId) {
      throw new DomainError('A resposta precisa pertencer à mesma tarefa.', 'TASK_COMMENT_REPLY_TASK_MISMATCH')
    }
  }
  const { data, error } = await client.from('task_comments').insert({
    workspace_id: workspaceId,
    task_id: taskId,
    author_member_id: authorMemberId,
    body: values.body,
    reply_to_comment_id: values.reply_to_comment_id,
  }).select('*').single()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Não foi possível criar o comentário.', 'TASK_COMMENT_CREATE_FAILED')
  await recordTaskActivity(workspaceId, taskId, 'task.comment_created', authorMemberId, { comment_id: data.id }, client)
  return data
}

export function replyToTaskComment(
  workspaceId: string,
  taskId: string,
  replyToCommentId: string,
  body: string,
  authorMemberId: string,
  client: SupabaseClient<Database> = supabase,
) {
  return createTaskComment(workspaceId, taskId, { body, reply_to_comment_id: replyToCommentId }, authorMemberId, client)
}

export async function updateTaskComment(
  workspaceId: string,
  commentId: string,
  input: { body: string },
  actorMemberId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskComment> {
  const current = await getTaskComment(workspaceId, commentId, client)
  await requireTaskMember(workspaceId, actorMemberId, client)
  if (current.author_member_id !== actorMemberId) {
    throw new DomainError('Somente o autor pode editar este comentário.', 'TASK_COMMENT_AUTHOR_REQUIRED')
  }
  const values = taskCommentUpdateSchema.parse(input)
  const { data, error } = await client.from('task_comments').update({ body: values.body })
    .eq('workspace_id', workspaceId).eq('id', commentId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Comentário não encontrado neste workspace.', 'TASK_COMMENT_NOT_FOUND')
  await recordTaskActivity(workspaceId, current.task_id, 'task.comment_edited', actorMemberId, { comment_id: commentId }, client)
  return data
}

export async function deleteTaskComment(
  workspaceId: string,
  commentId: string,
  actorMemberId: string,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskComment> {
  const current = await getTaskComment(workspaceId, commentId, client)
  await requireTaskMember(workspaceId, actorMemberId, client)
  if (current.author_member_id !== actorMemberId) {
    throw new DomainError('Somente o autor pode excluir este comentário.', 'TASK_COMMENT_AUTHOR_REQUIRED')
  }
  if (current.deleted_at) return current
  const { data, error } = await client.from('task_comments').update({ deleted_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId).eq('id', commentId).select('*').maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Comentário não encontrado neste workspace.', 'TASK_COMMENT_NOT_FOUND')
  await recordTaskActivity(workspaceId, current.task_id, 'task.comment_deleted', actorMemberId, { comment_id: commentId }, client)
  return data
}
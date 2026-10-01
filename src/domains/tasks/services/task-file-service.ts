import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { DomainError } from '@/domains/shared/domain-error'
import { mapTaskError } from '@/domains/tasks/helpers/task-error'
import { taskFileCreateSchema } from '@/domains/tasks/schemas/task-file-schema'
import { getTaskComment } from '@/domains/tasks/services/task-comment-service'
import { recordTaskActivity, requireTaskInWorkspace, requireTaskMember } from '@/domains/tasks/services/task-collaboration-service'
import type { TaskFile, TaskFileKind } from '@/domains/tasks/types'
import { supabase } from '@/lib/supabase/client'

async function getTaskFile(workspaceId: string, fileId: string, client: SupabaseClient<Database>): Promise<TaskFile> {
  const { data, error } = await client.from('task_files').select('*')
    .eq('workspace_id', workspaceId).eq('id', fileId).maybeSingle()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Arquivo não encontrado neste workspace.', 'TASK_FILE_NOT_FOUND')
  return data
}

export async function listTaskFiles(
  workspaceId: string,
  taskId: string,
  kind?: TaskFileKind,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskFile[]> {
  await requireTaskInWorkspace(workspaceId, taskId, client)
  let query = client.from('task_files').select('*').eq('workspace_id', workspaceId).eq('task_id', taskId)
  if (kind) query = query.eq('kind', kind)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw mapTaskError(error)
  return data ?? []
}

export function listTaskWorkingFiles(workspaceId: string, taskId: string, client: SupabaseClient<Database> = supabase) {
  return listTaskFiles(workspaceId, taskId, 'attachment', client)
}

export function listTaskFinalDeliveryFiles(workspaceId: string, taskId: string, client: SupabaseClient<Database> = supabase) {
  return listTaskFiles(workspaceId, taskId, 'final_delivery', client)
}

export function listTaskCommentAttachments(workspaceId: string, taskId: string, client: SupabaseClient<Database> = supabase) {
  return listTaskFiles(workspaceId, taskId, 'comment_attachment', client)
}

export async function createTaskFileMetadata(
  workspaceId: string,
  taskId: string,
  input: { kind: TaskFileKind; file_name: string; mime_type?: string | null; size_bytes?: number | null; storage_path?: string | null; comment_id?: string | null },
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
): Promise<TaskFile> {
  await requireTaskInWorkspace(workspaceId, taskId, client)
  const values = taskFileCreateSchema.parse(input)
  if (actorMemberId) await requireTaskMember(workspaceId, actorMemberId, client)
  if (values.kind === 'comment_attachment') {
    const comment = await getTaskComment(workspaceId, values.comment_id, client)
    if (comment.task_id !== taskId) {
      throw new DomainError('O anexo precisa apontar para comentário da mesma tarefa.', 'TASK_FILE_COMMENT_TASK_MISMATCH')
    }
  }
  const { data, error } = await client.from('task_files').insert({
    workspace_id: workspaceId,
    task_id: taskId,
    kind: values.kind,
    file_name: values.file_name,
    mime_type: values.mime_type,
    size_bytes: values.size_bytes,
    storage_path: values.storage_path,
    comment_id: values.comment_id ?? null,
    created_by_member_id: actorMemberId ?? null,
  }).select('*').single()
  if (error) throw mapTaskError(error)
  if (!data) throw new DomainError('Não foi possível registrar o arquivo.', 'TASK_FILE_CREATE_FAILED')
  await recordTaskActivity(workspaceId, taskId, 'task.file_added', actorMemberId, { file_id: data.id, kind: data.kind }, client)
  return data
}

export async function deleteTaskFileMetadata(
  workspaceId: string,
  fileId: string,
  actorMemberId?: string | null,
  client: SupabaseClient<Database> = supabase,
) {
  const current = await getTaskFile(workspaceId, fileId, client)
  const { error } = await client.from('task_files').delete()
    .eq('workspace_id', workspaceId).eq('id', fileId)
  if (error) throw mapTaskError(error)
  await recordTaskActivity(workspaceId, current.task_id, 'task.file_deleted', actorMemberId, { file_id: fileId, kind: current.kind }, client)
}
# CRATO 2 - Tasks V2 Collaboration Foundation

## Status do checkpoint

- ✅ Implementado: migration `20261001060000_extend_tasks_operations.sql` aplicada no Supabase DEV `uymghvccggslqlafchms`.
- ✅ Implementado: `task_number` e gerado por sequence PostgreSQL global, protegido por trigger e constraint `UNIQUE(task_number)`.
- ✅ Implementado: Checklist separado de Subtask, com criar, editar, concluir, reabrir, excluir e reordenar.
- ✅ Implementado: Comments com autor ativo, replies na mesma Task, edição por autor e soft delete.
- ✅ Implementado: metadados de arquivos de trabalho, entrega final e anexos de comentário. Upload/Storage não foi implementado; `storage_path` permanece opcional.
- ✅ Implementado: Entrega Final e composta por `tasks.final_copy` e arquivos `task_files.kind = final_delivery`.
- ✅ Implementado: Saved Views tipadas para `dashboard`, `calendar`, `kanban` e `list`, com default único por workspace, membro e tipo de view.
- ✅ Implementado: Subtasks continuam em `tasks.parent_task_id`; `listSubtasks` retorna a Task completa, incluindo numero, etapa, responsavel, datas e estados.
- ✅ Implementado: eventos de Checklist, Comments, Files e `final_copy` integram com `activity_log`. Saved Views nao geram activity de Task.
- ✅ Implementado: tipos de dominio para Checklist, Comments, Files, tipos de arquivo, Saved Views e settings tipados.
- 🟡 Parcial: RLS foi aplicada pela migration e o historico remoto confirmou sua aplicacao. O dump estrutural remoto nao foi executado porque `supabase db dump` requer Docker ou Podman, indisponivel neste ambiente.
- ⚠️ Precisa decisao: as mutacoes e o registro posterior de `activity_log` nao sao transacionais. Uma falha ao registrar activity pode ocorrer apos a escrita principal; essa divida permanece deliberadamente fora deste checkpoint.

## Banco e RLS

A migration aplicada cria `tasks.task_number`, `tasks.execution_date`, `tasks.sprint_id`, `sprints`, `task_checklist_items`, `task_comments`, `task_files` e `task_saved_views`.

As constraints e FKs isolam workspace nas relacoes de Task, Checklist, Comments, Files, Sprint e Saved Views. As tabelas novas usam RLS por `private.is_workspace_member(workspace_id)`; comments e saved views tambem restringem autoria/propriedade pelo membro autenticado.

## Verificacoes esperadas no fechamento

- `npm test`
- `npm run typecheck`
- `npm run build`
- `git diff --check`

## Escopo intencionalmente adiado

Nao foram iniciados Painel, Calendario, Kanban, Lista, Task Drawer ou Nova Tarefa.
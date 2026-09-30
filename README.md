# CRATO 2.0

Reconstrução oficial do CRATO a partir de uma base limpa.

## Princípios

- O CRATO 1 continua como referência funcional e não será refatorado neste repositório.
- O CRATO 2 será construído módulo por módulo.
- Cada módulo só é considerado pronto quando regra de negócio, UX, permissões, persistência, validações e testes estiverem consistentes.
- Nenhuma migration, segredo, token ou arquivo `.env` do CRATO antigo será reaproveitado.
- O foco inicial é: **Clientes** e **Tarefas**.

## Ordem inicial

1. Fundação mínima do produto
2. Clientes
3. Projetos vinculados ao cliente
4. Núcleo de Tarefas
5. Planejamento
6. Agenda, aprovações, capacidade e demais módulos

## Regra estrutural de Tarefas

A regra central do produto é:

`Tarefa -> Tipo de Tarefa -> Tipo x Departamento -> Etapa do Workflow`

O mesmo departamento pode ter etapas diferentes dependendo do Tipo de Tarefa.

Exemplo:

- Vídeo -> Criação -> Roteirizar / Editar / Ajustes
- Site -> Criação -> Wireframe / Design / Responsivo

Portanto, Departamento e Etapa não são campos independentes. A etapa atual precisa pertencer ao fluxo válido daquele Tipo de Tarefa.

Veja `docs/BLUEPRINT.md` e `AGENTS.md` antes de implementar qualquer módulo.

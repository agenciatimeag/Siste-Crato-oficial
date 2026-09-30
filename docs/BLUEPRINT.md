# Blueprint do CRATO 2.0

## Objetivo

Reconstruir o CRATO a partir de uma base limpa, preservando as regras de negócio corretas do sistema atual e eliminando acoplamentos, inconsistências e histórico técnico desnecessário.

## Escopo inicial

Os dois módulos prioritários são:

1. Clientes
2. Tarefas

Projetos entra como entidade-base entre Cliente e Tarefa, mesmo que a primeira interface seja mínima.

---

# 1. Clientes

## Papel no sistema

Cliente é a entidade comercial/operacional principal. Um cliente pode possuir vários projetos e suas tarefas, planejamentos, aprovações e demais dados devem ser vinculados a ele por relações explícitas.

## V1

Campos mínimos:

- Nome
- Nome fantasia, quando aplicável
- Status: ativo / inativo
- Logo
- Contato principal
- E-mail
- Telefone / WhatsApp
- Observações
- Responsável interno pela conta
- Data de entrada
- Data de encerramento, quando houver

## Relações

Cliente
- possui Projetos
- possui Tarefas por meio dos Projetos e/ou vínculo direto quando necessário
- futuramente possui Contratos / Serviços
- futuramente possui Planejamentos
- futuramente possui Aprovações
- futuramente possui arquivos e histórico

## Regras

- Cliente inativo não deve desaparecer do histórico.
- Cliente não deve ser excluído fisicamente se já possuir relações operacionais relevantes.
- A interface deve permitir encontrar rapidamente projetos, tarefas abertas e informações operacionais do cliente.
- O detalhe do cliente será uma página, não um modal.

---

# 2. Projetos

Projeto é uma entidade-base do sistema e pertence a um Cliente.

## V1 mínima

- Nome
- Cliente
- Status
- Responsável
- Data de início
- Data de encerramento opcional
- Descrição

Um projeto poderá futuramente possuir escopo, serviços contratados, planejamento, orçamento, capacidade e indicadores.

---

# 3. Núcleo de Tarefas

## Regra central

A estrutura correta é:

Tarefa
→ Tipo de Tarefa
→ relação Tipo de Tarefa × Departamento
→ Departamento atual
→ Etapa do Workflow

O Departamento não possui etapas universais.

Exemplo:

Vídeo
→ Criação
  → Roteirizar
  → Editar
  → Ajustes

Site
→ Criação
  → Wireframe
  → Design
  → Responsivo

O departamento "Criação" pode ser o mesmo registro organizacional, mas as etapas pertencem ao contexto Tipo de Tarefa × Departamento.

## Entidades do workflow

### task_types
Define o tipo de trabalho.

Exemplos:
- Vídeo
- Arte
- Site
- Blog

### departments
Define os departamentos organizacionais.

Exemplos:
- Planejamento
- Criação
- Revisão
- Desenvolvimento

### task_type_departments
Relaciona um Tipo de Tarefa a um Departamento e define a ordem daquele departamento dentro do fluxo daquele tipo.

Campos conceituais mínimos:
- task_type_id
- department_id
- position

### workflow_steps
Etapas pertencentes a uma relação task_type_departments.

Campos conceituais mínimos:
- task_type_department_id
- nome
- posição
- natureza operacional
- revisão interna
- revisão externa
- revisão/ajuste
- inicia timesheet
- para timesheet
- tempo estimado opcional

## Natureza operacional da etapa

A etapa poderá representar semanticamente:
- todo
- in_progress
- waiting
- done
- complete

O nome visível da etapa é livre. A natureza operacional serve para comportamento sistêmico.

Exemplo:
"Editar" pode ter natureza `in_progress`.
"Aguardando cliente" pode ter natureza `waiting`.

## Regra de consistência

Uma tarefa nunca pode possuir uma workflow_step que não pertença ao seu task_type.

Departamento atual deve ser derivável da etapa atual.

Se o Tipo de Tarefa mudar:
- a etapa antiga deve ser invalidada quando não pertencer ao novo tipo;
- o sistema deve resolver um novo ponto válido do workflow;
- padrão inicial: primeiro departamento + primeira etapa, salvo escolha explícita válida.

Se o Departamento mudar:
- o departamento precisa pertencer ao Tipo atual;
- a tarefa deve entrar na primeira etapa válida daquele departamento, salvo escolha explícita válida.

## Campos essenciais da Tarefa V1

- Título
- Cliente
- Projeto
- Tipo de Tarefa
- Workflow Step atual
- Responsável
- Revisor
- Prioridade
- Data de início
- Data de entrega
- Data de publicação opcional
- Briefing / descrição
- Copy / texto final opcional
- Tags
- Arquivada
- Criada por
- Datas de criação e atualização

## Elementos que pertencem à tarefa e serão preservados

- Checklist
- Subtarefas reais
- Anexos
- Comentários
- Histórico de atividade
- Responsável e Revisor como papéis distintos
- Aprovações em etapa posterior
- Timesheet em etapa posterior
- Recorrência em etapa posterior

## Checklist x Subtarefa

Checklist é controle simples interno da tarefa.

Subtarefa é uma tarefa real ligada a uma tarefa-pai e deve obedecer às mesmas regras de workflow das demais tarefas.

## Histórico

Alterações operacionais importantes devem gerar histórico auditável, incluindo:
- criação
- mudança de etapa
- mudança de prioridade
- responsável
- revisor
- datas
- briefing
- anexos
- comentários
- arquivamento

O registro do histórico deve ser centralizado e não depender de cada tela implementar sua própria lógica.

---

# 4. Relação inicial entre os módulos

Cliente
→ Projeto
→ Tarefa
→ Tipo de Tarefa
→ Tipo × Departamento
→ Etapa

O Planejamento será construído depois sobre essa fundação e converterá itens em tarefas válidas usando o mesmo motor de workflow.

---

# 5. UX definida para V1

- SaaS premium, claro, minimalista e operacional.
- Sidebar por áreas.
- Tabelas limpas e densidade controlada.
- Tarefa abre preferencialmente em drawer lateral.
- Cliente abre em página de detalhe.
- Modal apenas para ações simples.
- Mesma base de tarefas poderá ter Lista, Kanban, Tabela e Calendário no futuro.
- Não criar UI de ERP tradicional.
- Não usar cores diferentes apenas para identificar módulos; cores devem ser principalmente semânticas.

---

# 6. Ordem de implementação

1. Fundação técnica
2. Autenticação / organização / usuário mínimo
3. Clientes
4. Projetos mínimos
5. Configuração de Tipos de Tarefa
6. Configuração de Departamentos
7. Configuração de Workflow por Tipo × Departamento
8. Tarefas
9. Drawer da Tarefa
10. Checklist / subtarefas / anexos / comentários / histórico
11. Planejamento
12. Demais módulos

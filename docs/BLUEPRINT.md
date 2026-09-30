# Blueprint do CRATO 2.0

## Objetivo

Reconstruir o CRATO a partir de uma base limpa, preservando as regras de negócio corretas do sistema atual e eliminando acoplamentos, inconsistências e histórico técnico desnecessário.

## Escopo inicial

A ordem estrutural da primeira versão é:

1. Fundação técnica
2. Autenticação / organização / usuário mínimo
3. Clientes
4. Contratos e condições financeiras
5. Projetos
6. Motor de workflow
7. Tarefas

A relação operacional principal é:

`Cliente -> Projeto -> Tarefa`

Contrato é uma entidade própria vinculada ao Cliente.

---

# 1. Clientes

## Papel no sistema

Cliente é a raiz comercial e operacional. Um cliente pode possuir vários contratos e vários projetos. As tarefas pertencem aos projetos e chegam ao cliente por essa relação.

## Dados principais

- Nome de exibição
- Razão social
- Nome fantasia
- CNPJ
- Telefone
- E-mail
- Status: ativo / pausado / inativo
- Responsável interno pela conta
- Observações
- Data de entrada
- Data de encerramento, quando houver

## Contatos do cliente

Um cliente pode possuir vários contatos. Um deles pode ser marcado como contato principal.

Cada contato pode possuir:
- Nome
- Cargo / função
- E-mail
- Telefone
- Observações

## Regras

- Cliente inativo não desaparece do histórico.
- Cliente com relações operacionais relevantes não deve ser excluído fisicamente.
- O detalhe do cliente é uma página, não um modal.
- A interface deve permitir encontrar rapidamente contratos, projetos, tarefas e atividade recente.

---

# 2. Contratos

Contrato pertence a um Cliente e não deve ser confundido com o próprio cadastro do cliente.

Um cliente pode possuir mais de um contrato ao longo do tempo ou simultaneamente.

## Formas de criação

- A partir de modelo
- Escrito manualmente
- Contrato/documento já existente

Modelos de contrato são registros independentes e podem ser reutilizados.

Quando um contrato nasce de um modelo, seu conteúdo deve ser copiado para o contrato para que futuras alterações no modelo não mudem contratos antigos.

## Dados do contrato

- Cliente
- Título
- Código opcional
- Origem: modelo / manual / upload
- Status: rascunho / ativo / pausado / encerrado / cancelado
- Conteúdo do contrato
- Data de início
- Data final
- Data de assinatura, quando houver
- Observações

## Condições financeiras

As condições financeiras pertencem ao contrato.

Formas iniciais:
- Recorrente
- À vista
- Parcelado

Campos possíveis conforme a forma:
- Valor total
- Valor recorrente
- Valor da parcela
- Quantidade de parcelas
- Dia de vencimento
- Primeiro vencimento
- Moeda BRL

Valores monetários devem ser persistidos em centavos, não em ponto flutuante.

## Vencimento do contrato

O sistema deve calcular visualmente o tempo restante a partir da data final do contrato. Não persistir um campo do tipo "faltam X dias".

A data final deve permitir alertas futuros, como 60, 30, 15 e 7 dias antes do vencimento.

Integrações futuras como Autentique e Asaas devem se apoiar nesta estrutura sem virar a fonte principal da regra de negócio.

---

# 3. Projetos

Projeto é uma subestrutura operacional do Cliente.

Um Cliente pode possuir um ou mais Projetos.

Exemplos:
- Social Media
- Casa Cor 2026
- Campanha Dia das Mães
- Novo Site

## Dados do projeto

- Nome
- Cliente
- Descrição
- Status: ativo / pausado / finalizado
- Data de início
- Data prevista de término
- Data real de conclusão
- Responsável principal
- Observações

## Squad

Projeto pode possuir vários membros responsáveis.

A relação é muitos-para-muitos entre Projeto e membros da organização.

Cada vínculo pode possuir:
- Papel no projeto
- Indicação de liderança

O responsável principal do projeto não substitui o Squad.

## Arquivos importantes

Projeto pode possuir arquivos ou links importantes relacionados especificamente àquela operação.

Arquivos de projeto não devem ser misturados com anexos de tarefas.

## Regra estrutural

Uma tarefa pertence obrigatoriamente a um Projeto.

O Cliente da tarefa é derivável pelo Projeto. A aplicação nunca deve permitir uma combinação em que o Projeto pertença a outro Cliente.

---

# 4. Organização e usuários

O CRATO é organizado por Workspace.

Usuários autenticados participam de um Workspace através de vínculos de membro.

Papéis iniciais:
- owner
- admin
- member

Clientes, contratos, projetos e tarefas devem pertencer explicitamente ao Workspace.

As regras de acesso devem ser protegidas no banco com Row Level Security, não apenas na interface.

---

# 5. Histórico

Alterações operacionais relevantes devem gerar histórico auditável centralizado.

No núcleo inicial, o histórico deve suportar pelo menos:
- Cliente
- Contrato
- Projeto

Tarefas entrarão posteriormente na mesma estratégia de histórico.

---

# 6. Núcleo de Tarefas

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

O Cliente é derivado pelo Projeto e não deve ser persistido como uma relação independente que possa divergir.

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

---

# 7. IA invisível

O CRATO pode usar IA em várias partes do produto, mas a IA não deve determinar a estética da interface.

Regras:
- evitar ícones e clichês visuais de IA;
- preferir ações com nomes orientados ao resultado;
- não depender de chat aberto como interface principal;
- IA sugere, regras do sistema validam e o banco executa;
- outputs usados para alterar o sistema devem ser estruturados e validados pelas regras de domínio.

---

# 8. UX definida para V1

- SaaS B2B premium, claro, denso e operacional.
- Sidebar compacta por áreas.
- Tabelas e listas limpas com boa densidade.
- Tarefa abre preferencialmente em drawer lateral.
- Cliente e Projeto possuem páginas próprias.
- Modal apenas para ações simples.
- Filtros em popover quando fizer sentido.
- Não criar UI de ERP tradicional.
- Não criar aparência de template genérico de IA.
- Cores são principalmente semânticas.

---

# 9. Ordem de implementação

1. Fundação técnica
2. Autenticação / organização / usuário mínimo
3. Clientes e contatos
4. Contratos e condições financeiras
5. Projetos, Squad e arquivos
6. Configuração de Tipos de Tarefa
7. Configuração de Departamentos
8. Configuração de Workflow por Tipo × Departamento
9. Tarefas
10. Drawer da Tarefa
11. Checklist / subtarefas / anexos / comentários / histórico
12. Planejamento
13. Demais módulos

# CRATO 2.0 — Instruções para agentes de código

Leia `README.md` e `docs/BLUEPRINT.md` antes de implementar qualquer funcionalidade.

## Regras de segurança

- Nunca adicionar `.env`, chaves, tokens, senhas ou credenciais ao repositório.
- Não reutilizar migrations, schema ou configurações do CRATO antigo.
- Não conectar este projeto ao banco de produção antigo.
- Mudanças de banco devem ser pequenas, explícitas e revisáveis.
- Não fazer commit/push automaticamente quando trabalhando localmente sem autorização do usuário.

## Estratégia do projeto

Este é um rebuild limpo do CRATO, não uma refatoração do repositório antigo.

O CRATO atual é apenas referência funcional e de regras de negócio.

Implementar módulo por módulo, sem antecipar módulos futuros de forma desnecessária.

## Prioridades

1. Fundação
2. Clientes
3. Projetos mínimos
4. Núcleo de Tarefas

## Regra estrutural obrigatória de Tarefas

Nunca simplificar workflow para `Departamento -> Status`.

A regra correta é:

`Task -> Task Type -> Task Type Department -> Workflow Step`

O mesmo departamento pode possuir etapas diferentes dependendo do Tipo de Tarefa.

Qualquer criação, edição, importação ou automação de tarefa deve validar essa relação.

## UX

- SaaS premium e minimalista.
- Desktop-first com boa adaptação mobile.
- Tarefa abre em drawer lateral sempre que o contexto permitir.
- Cliente possui página própria.
- Evitar modal para fluxos complexos.
- Evitar componentes redundantes.
- Cores são principalmente semânticas.

## Qualidade

Antes de considerar uma etapa concluída:

- typecheck deve passar;
- build deve passar;
- regras de negócio críticas devem possuir testes;
- estados de loading, vazio e erro devem existir quando aplicável;
- nenhuma combinação inválida de workflow deve ser persistível.

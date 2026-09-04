# Gestão da unidade: já é o Cronograma

Sim — essa página já existe. A aba **Cronograma** (em Operacional) é exatamente onde se define o que cada pessoa faz, em que horário e em que dia da semana. Criar uma página nova duplicaria isso.

## O que já está lá hoje

Ao criar ou editar uma atividade no Cronograma você já configura:
- **Horário** (campo de hora)
- **Responsável** (funcionário da unidade)
- **Dias da semana**, formulário vinculado e mensagem

E em **Gestão do dia** você acompanha status, atraso, responsável e prioridade, com filtro por prioridade.

## A única lacuna real

A **prioridade** (e o **setor**) da atividade existe no sistema e é usada para filtrar, colorir e disparar alertas de "críticas atrasadas" — mas **não há campo para editá-la** na criação/edição da atividade. Hoje toda atividade nasce como "normal".

## Proposta (sem tocar o banco)

Adicionar dois seletores nos formulários de atividade do Cronograma, ao lado de Horário e Responsável:

1. **Prioridade** — Baixa / Normal / Alta / Crítica
2. **Setor** — para direcionar a visibilidade por setor que já existe no EVO OPS

Aplicado em três lugares:
- Formulário de nova atividade
- Formulário de edição rápida da atividade
- Painel de detalhes da atividade (exibir prioridade e setor com o mesmo padrão visual de Gestão do dia)

## Detalhes técnicos

- Somente frontend: as colunas `prioridade` e `setor` já existem em `cronograma_atividades` e já são lidas por `useOpsGestao`. Nenhuma migração necessária.
- Editar `src/components/cronograma/CronogramaTab.tsx` (estado do form, `Select` de prioridade e setor, payload de criar/atualizar) e reutilizar os rótulos/cores de prioridade já definidos em `GestaoDiaTab`, extraindo-os para um módulo compartilhado para evitar divergência.
- Nada de novas rotas, páginas ou itens de menu.

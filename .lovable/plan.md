# KPI "FU Gerente" no Dashboard

Novo KPI clicável no Dashboard, com a mesma mecânica do "Follow-up de Matriculados": lista de alunos matriculados, envio 100% manual pelo WhatsApp, com marcar como realizado e reagendar. Só duas etapas: D+7 e D+30.

## Regra da régua

Baseada nos dias desde a data de matrícula (data de fechamento):

```text
0 a 6 dias    -> não aparece
7 a 29 dias   -> mostra D+7
30 a 45 dias  -> mostra D+30
acima de 45   -> não aparece
```

Etapas já marcadas como realizadas (ou reagendadas para o futuro) saem da lista, igual ao painel de matriculados.

## Mensagens (campos preenchidos automaticamente)

- `[nome]` = primeiro nome do aluno
- `[nome do gerente]` = nome do usuário logado
- `[unidade]` = unidade atual selecionada

D+7:

> Olá, {nome}! Tudo bem?
>
> Aqui é {gerente}, gerente da Iron {unidade}. Estou passando para saber como foi sua primeira semana com a gente.
>
> Você conseguiu realizar os agendamentos normalmente? Foi bem recebido pela equipe e sentiu que teve o acompanhamento necessário durante os treinos?
>
> Também queria saber se ficou alguma dúvida sobre nossa metodologia ou se encontrou alguma dificuldade nesse início.
>
> Pode falar com sinceridade. Seu feedback é muito importante para garantirmos que sua experiência seja cada vez melhor.

D+30:

> Olá, {nome}! Tudo bem?
>
> Você está completando seu primeiro mês na Iron e queria acompanhar um pouco mais de perto como está sendo sua experiência.
>
> Como você avalia sua evolução até aqui? Já percebeu alguma mudança no condicionamento, na execução dos exercícios, na disposição ou nos resultados?
>
> Também estamos avaliando sua frequência para entender se sua rotina de treinos está funcionando bem ou se precisamos realizar algum ajuste.
>
> Tem algum ponto que podemos melhorar no acompanhamento, nos horários, no atendimento ou na sua experiência dentro da unidade?
>
> Conte comigo e com toda a equipe. Nosso objetivo não é apenas que você treine, mas que tenha direção, constância e resultado.

Nenhum envio automático: o clique só abre o WhatsApp com o texto pronto, sem disparar mensagem.

## Detalhes técnicos

1. Migração no banco: ampliar o CHECK de `follow_ups.tipo` para aceitar `G+7` e `G+30` (tipos exclusivos do FU Gerente, para não conflitar com os follow-ups comerciais/matriculados existentes).
2. Novo hook `src/hooks/useFollowUpsGerente.ts`, espelhando `useFollowUpsMatriculados.ts`: busca matrículas por `unidade_id`, calcula a etapa pela régua acima, exclui etapas `G+7`/`G+30` concluídas ou reagendadas para o futuro, com realtime em `follow_ups` e `interacoes`.
3. Nova seção `src/components/dashboard/FollowUpGerenteSection.tsx`, baseada em `FollowUpMatriculadosSection.tsx` (cards horizontais, badge da etapa, data do FU, dias em atraso, ações: WhatsApp, marcar realizado via `upsert` em `follow_ups`, reagendar, ver aluno). Nome do gerente vindo do usuário autenticado (metadata/`user_profiles`), unidade vinda de `UnidadeContext`.
4. `DashboardKPIGrid.tsx`: novo KPI "FU Gerente" com contagem de pendentes (vencidos/hoje), clicável e com estado ativo.
5. `Dashboard.tsx`: estado `showFollowUpGerenteSection`, handler de clique com scroll e renderização da nova seção.

## Fora de escopo

Nenhum cron, edge function ou envio automático será criado para este KPI.

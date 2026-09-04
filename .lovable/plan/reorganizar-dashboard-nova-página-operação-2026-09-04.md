# Reorganizar Dashboard + nova página Operação

Objetivo: o Dashboard responde "como está a performance da unidade?" e a nova página Operação responde "o que precisa acontecer hoje nesta unidade?". Nada de novo banco, autenticação, automações de WhatsApp ou regras de negócio. Só reorganização e reaproveitamento.

## 1. O que PERMANECE no Dashboard

- `DashboardHeader` (título, badge da unidade, filtro de período) + `SyncIndicator`
- `MetaVsRealizadoCard` (alunos ativos, meta, faltantes, %, barra)
- KPIs principais: Alunos Ativos, Total de Leads, Experimentais Agendadas, Compareceram, Matrículas, Conversão Geral
- Taxas do Funil: Lead vira Experimental, Comparecimento, Experimental vira Matrícula
- `FunilComercialCard` e `DiagnosticoSemanaCard`
- Seções de detalhe estratégicas: `MatriculasDetailSection`, `ExperimentaisDetailSection` e a aba "Visão do Período" (`ExperimentaisSemana` com filtros de período)

## 2. O que SAI do Dashboard e vai para Operação (nenhum arquivo apagado)

- `FollowUpKPI`, `FollowUpMatriculadosKPI`, `FollowUpGerenteKPI`, `TaxaComparecimentoKPI`
- KPI "Não Compareceram" e KPI "Experimentais da Semana"
- `FollowUpSections` + `CompactRelatorioFollowUps`, `FollowUpMatriculadosSection`, `FollowUpGerenteSection`
- `EventosHoje`, `ConfirmacoesAmanha`, `AtividadesDoDia`, `PendenciasDia`, `ReagendarModal`

## 3. Componentes reaproveitados sem alteração

Todos os listados acima, além dos hooks: `useDashboardData`, `useDashboardEventos`, `useDashboardFollowUps`, `useFollowUpsMatriculados`, `useFollowUpsGerente`, `useOpsGestao`, `useUnidade`. Cálculos e filtros por unidade permanecem intocados.

## 4. Novos componentes (poucos e finos)

- `src/pages/Operacao.tsx` — nova página, usa `Layout` e a unidade selecionada.
- `src/components/operacao/OperacaoKPIRow.tsx` — linha compacta com os 6 KPIs operacionais (só reagrupa os cards existentes).
- `src/components/operacao/AtividadesUnidadeResumo.tsx` — resumo do dia: Previstas / Concluídas / Em andamento / Atrasadas.
- `src/components/operacao/TarefasDeHojeList.tsx` — lista compacta (título, responsável, horário, status, prioridade) usando `OpsStatusBadge`.
- `src/components/operacao/AtencaoCard.tsx` — seção ATENÇÃO com itens acionáveis, cada um navegando/expandindo a área correspondente.
- `src/components/dashboard/DashboardKPIGrid.tsx` passa a receber apenas os KPIs estratégicos (props operacionais viram opcionais para não quebrar nada).

## 5. Como "Atividades da Unidade" se integra às tarefas existentes

Usa o hook já existente `useOpsGestao(date)`, que lê `cronograma_atividades` (do dia da semana, `ativo=true`, ignorando canceladas) + `ops_execucoes` do dia e deriva o status via `deriveOpsStatus`. Na página Operação os resultados são filtrados pela unidade selecionada (`unidadeAtual.id`), aproveitando `resumoPorUnidade` e `criticasAtrasadas`. Mesmos registros do EVO OPS — sem duplicar tarefas, sem nova consulta paralela, sem mudança de RLS. Diferença de escopo: Operação = visão da unidade; EVO OPS/Meu Dia = visão do usuário.

## 6. Status e cores

Prevista (azul), Em andamento (laranja), Concluída (verde), Atrasada (vermelho), Cancelada (cinza) — usando os tokens semânticos já definidos e o `OpsStatusBadge` existente (ajuste só do tom de "pendente" → azul discreto e "em_andamento" → laranja, mantendo os labels).

## 7. Arquivos alterados

- Novo: `src/pages/Operacao.tsx`, `src/components/operacao/*` (4 arquivos)
- Editado: `src/pages/Dashboard.tsx` (remove blocos operacionais), `src/components/dashboard/DashboardKPIGrid.tsx`, `src/App.tsx` (rota `/operacao`), `src/components/Layout.tsx` (item "Operação" logo após Dashboard), `src/components/ops/OpsStatusBadge.tsx` (só cores)

Sem migração de banco. Sem toque em Edge Functions, cron jobs, WhatsApp, CRM, Gestão Operacional/Cronograma ou EVO OPS.

## 8. Riscos e mitigação

- Props removidas do `DashboardKPIGrid` poderiam quebrar outro consumidor → tornar opcionais e checar usos antes.
- Duplicação de fetch entre Dashboard e Operação: cada página monta seu próprio `useDashboardData`; mitigado por não abrir as duas ao mesmo tempo e por o hook já ser cacheado/escopado por unidade.
- Usuários acostumados ao Dashboard antigo perderão a referência dos follow-ups → deixar o item "Operação" em destaque no menu, na posição 2.
- Ajuste de cor no `OpsStatusBadge` afeta EVO OPS visualmente (não funcionalmente); manter tons discretos.

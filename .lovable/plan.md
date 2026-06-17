# Corrigir mensagem WhatsApp do Relatório Diário — Comercial

## Problema

O formulário foi atualizado para a nova estrutura de 4 blocos, mas a mensagem enviada ao grupo do WhatsApp continua usando o template antigo (com "Receita do mês", "Ticket médio", "Evasão", contadores numéricos de matrículas/renovações etc.).

O template fica em `supabase/functions/_shared/notifyFormularioCore.ts`, função `renderRelatorioComercial` (linhas 191-223), e é usada por todas as edge functions de notificação de formulário.

## Mudanças

### 1. `supabase/functions/_shared/notifyFormularioCore.ts`

Reescrever `renderRelatorioComercial(row)` para refletir os campos reais que o formulário hoje grava em `relatorio_diario_comercial_respostas`:

- **Identificação:** Responsável (`nome`), Data (`data`)
- **Indicadores do dia:**
  - Total de alunos ativos — `total_alunos_ativos` (manter `(Meta: X)` se `meta_alunos` existir no `_meta`)
  - Leads recebidos — `leads_recebidos`
  - Experimentais agendadas — `experimentais_agendadas`
  - Experimentais realizadas — `experimentais_realizadas`
  - Fechamento nas experimentais — `fechamento_experimentais` (mapear enum para "Sim, todas" / "Sim, parcial" / "Nenhuma" / "Não houve experimental hoje")
  - Quantos não fecharam — `qtd_nao_fecharam` (só se preenchido)
  - Motivo do não fechamento — `motivo_nao_fechamento` (mapear enum; se `OUTRO`, usar `motivo_nao_fechamento_outro`)
  - Novas matrículas hoje — `novas_matriculas_texto`
  - Renovações hoje — `renovacoes_texto`
  - Cancelamentos hoje — `cancelamentos_texto`
  - Não renovações hoje — `nao_renovados_texto`
  - Inadimplentes ativos — `inadimplentes_texto`
- **Ocorrências e feedbacks:**
  - Ocorrência fora do comum — `ocorrencia` + `ocorrencia_descricao`
  - Feedback negativo — `feedback_negativo` + `feedback_negativo_descricao`
  - Ação tomada — `feedback_acao_tomada` + `feedback_acao_descricao` (só se feedback negativo = Sim)
- **Observações finais:** Para a liderança — `observacoes`

Remover do template: **Receita do mês**, **Ticket médio**, **Evasão**, **Novas matrículas (contador)**, **Renovações (contador)**, **Cancelamentos (contador)**, **Não renovados (contador)**, **Inadimplentes (contador)**.

### 2. Mesmo arquivo, `executeNotification` (linhas 388-417)

Limpar o bloco que busca `_meta`: manter somente `meta_alunos` (de `gestao_metas.meta_alunos_mes`) — é o único valor ainda usado. Remover a query de `interacoes` (cálculo de `receitaMes`) e os campos `receita_mes`, `ticket_medio`, `evasao` do `_meta`, já que não aparecem mais no template.

## Detalhes técnicos

- Os mapeamentos de enum (`fechamento_experimentais`, `motivo_nao_fechamento`) ficam locais a `renderRelatorioComercial`, espelhando os labels usados em `src/pages/RelatorioDiarioComercial.tsx` (`fechamentoLabels`, `motivoLabels`).
- A filtragem `it.value && it.value !== '—'` em `buildMessage` (linha 241) já cuida de esconder linhas vazias automaticamente — basta retornar `'—'` ou string vazia para campos não preenchidos (ex: quantos não fecharam quando `fechamento` é `TODAS` ou `NAO_HOUVE`).
- Não há mudança em rotas, schema, RLS, ou no componente do formulário — só no renderer da mensagem.
- Nenhuma outra edge function precisa ser tocada: todas usam `buildMessage` via `notifyFormularioCore.ts`.

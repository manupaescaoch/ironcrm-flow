## Filtros de status em "Experimentais do Período"

No componente `src/components/dashboard/ExperimentaisSemana.tsx` (aba Visão do Período do Dashboard), adicionar uma barra de chips clicáveis logo abaixo do título "Experimentais do Período", reaproveitando o padrão visual já usado no CRM (chips roláveis horizontalmente).

### Chips de filtro

- **Todos** (default)
- **Agendados** — `compareceu === null` e horário futuro
- **Compareceu** — `compareceu === true`
- **Não compareceu** — `compareceu === false` ou (passado e `compareceu === null`)
- **Matriculou** — `interacao.fechou_matricula === true`

Cada chip mostra a contagem ao lado do label (ex.: "Matriculou 12"), calculada sobre os experimentais do período selecionado.

### Comportamento

- Filtro aplicado em cima da lista atual (após o filtro de período já existente — Todo Período / 7 dias / Mês Atual / Mês Anterior).
- Dias sem itens após o filtro são ocultados; o badge "70 total" passa a refletir o total filtrado.
- Seleção única (clicar de novo no mesmo chip volta para "Todos").
- Estado mantido apenas em memória (sem persistir).

### Arquivos

- `src/components/dashboard/ExperimentaisSemana.tsx` — adicionar estado `statusFilter`, função `matchesStatus(item)`, contadores e a barra de chips.

Sem mudanças em banco, RLS ou edge functions.
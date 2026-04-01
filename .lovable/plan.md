

## Unificar Rotinas no Cronograma e Remover Página Rotinas

### Situação Atual
- A página **Operacional** tem 5 abas: Rotinas, Cronograma, Dashboard, Equipe, Formulários
- Rotinas usa seu próprio calendário semanal (`RotinasCalendario`) com grade horária 05h–23h
- Cronograma usa `CronogramaTab` com grade horária idêntica (05h–23h)
- Ambos mostram eventos semanais baseados em dia/horário — lógica muito similar
- Existe `src/pages/Rotinas.tsx` standalone (não roteado no App, mas o arquivo existe)

### Plano

**1. Mostrar rotinas dentro do CronogramaTab**
- No `CronogramaTab`, além de buscar `cronograma_atividades`, também buscar rotinas ativas via `useRotinasData`
- Converter rotinas para o mesmo formato visual do grid: mapear `frequencia` (`semanal:seg,ter,qua,qui,sex`) para `dia_semana` (0-6) e `horario_esperado` para slot de hora
- Renderizar rotinas no grid com cor diferenciada por setor (usando as mesmas cores do `RotinasCalendario`: azul=Coordenação, verde=Limpeza, laranja=Recepção, etc.)
- Ao clicar numa rotina no grid, abrir popup com detalhes e botão para editar (abrindo `RotinaModal`)
- Manter as ações de CRUD de rotinas (criar, editar, duplicar, arquivar, excluir) acessíveis via o modal

**2. Adicionar botão "Nova Rotina" ao header do Cronograma**
- Junto ao botão "Nova Atividade", adicionar botão "Nova Rotina" que abre o `RotinaModal`
- KPIs de rotinas e filtros podem ir para a aba Dashboard ou serem integrados no header

**3. Remover a aba "Rotinas" do Operacional**
- Remover o tab `rotinas` da página `Operacional.tsx`
- Aba padrão passa a ser `cronograma`
- Remover imports dos componentes exclusivos da aba rotinas (KPIGrid, Filters, Lista, Kanban, Calendário) do `Operacional.tsx`

**4. Excluir `src/pages/Rotinas.tsx`**
- Deletar o arquivo standalone

**5. Mover KPIs de Rotinas para o Dashboard do Operacional**
- O `CronogramaDashboard` passa a incluir os KPIs de execução de rotinas (total, concluídas, pendentes)

### Detalhes Técnicos
- Frequência `semanal:seg,ter,qua,qui,sex` → mapeamento: `seg=1, ter=2, qua=3, qui=4, sex=5, sab=6, dom=0`
- Frequência `diaria` → aparece em todos os 7 dias
- Rotinas sem `horario_esperado` ficam na seção "sem horário" do grid
- Rotinas renderizadas com badge visual "Rotina" para diferenciar de atividades do cronograma
- Componentes de rotinas (`src/components/rotinas/*`) continuam existindo — só mudam onde são consumidos

### Arquivos Alterados
- `src/components/cronograma/CronogramaTab.tsx` — integrar rotinas no grid
- `src/pages/Operacional.tsx` — remover aba Rotinas, default para cronograma
- `src/components/cronograma/CronogramaDashboard.tsx` — incluir KPIs de rotinas
- `src/pages/Rotinas.tsx` — deletar


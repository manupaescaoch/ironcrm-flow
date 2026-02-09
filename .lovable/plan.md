
# Tarefas Recorrentes

## O que será implementado
Adicionar a funcionalidade de tarefas recorrentes ao sistema, permitindo definir a periodicidade com que uma tarefa se repete (ex: toda segunda-feira, diariamente, semanalmente, mensalmente).

## Como vai funcionar

### Para o usuário
1. Ao criar ou editar uma tarefa, um novo campo **"Recorrencia"** aparece no modal
2. Opcoes de periodicidade:
   - **Nenhuma** (padrao)
   - **Diaria** - repete todo dia
   - **Semanal** - escolhe o(s) dia(s) da semana (ex: segunda, quarta, sexta)
   - **Quinzenal** - a cada 15 dias
   - **Mensal** - a cada mes
3. Campo opcional **"Repetir ate"** para definir data de fim da recorrencia
4. Quando uma tarefa recorrente e marcada como "Concluida", o sistema cria automaticamente a proxima ocorrencia com a data do proximo prazo

### Detalhes Tecnicos

**1. Atualizar `TaskInsert` para incluir campos de recorrencia**
- Arquivo: `src/hooks/useTarefasData.ts`
- Incluir `recorrencia` e `recorrencia_fim` no tipo `TaskInsert`
- Adicionar constante `RECORRENCIA_OPTIONS` com as opcoes disponiveis
- Valores de recorrencia no banco: `diaria`, `semanal:seg`, `semanal:seg,qua,sex`, `quinzenal`, `mensal`

**2. Adicionar campos no modal de tarefa**
- Arquivo: `src/components/tarefas/TarefaModal.tsx`
- Novo campo Select "Recorrencia" apos o bloco de Prazo/Horario
- Quando "Semanal" for selecionado, mostrar checkboxes para os dias da semana
- Campo opcional de data "Repetir ate" (calendario)
- Icone de repeticao (Repeat) para indicar visualmente

**3. Logica de criacao da proxima tarefa**
- Arquivo: `src/hooks/useTarefasData.ts`
- Na funcao `updateTaskStatus`, quando status muda para `concluida` e a tarefa tem recorrencia:
  - Calcular proxima data baseada na periodicidade
  - Verificar se a proxima data nao ultrapassa `recorrencia_fim`
  - Criar nova tarefa com os mesmos dados e novo prazo
  - Manter a tarefa concluida no historico

**4. Indicador visual nos cards de tarefa**
- Arquivo: `src/components/tarefas/TarefaCard.tsx`
- Mostrar icone de repeticao nos cards de tarefas recorrentes
- Tooltip com a periodicidade configurada

**5. Filtro por recorrencia**
- Arquivo: `src/components/tarefas/TarefasFilters.tsx`
- Adicionar opcao de filtrar tarefas recorrentes vs. unicas

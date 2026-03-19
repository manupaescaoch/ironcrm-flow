

## Corrigir Dashboard do Cronograma Operacional

**Problema**: A edge function `send-cronograma-messages` só registra envios na tabela `cronograma_envios` quando a atividade tem `formulario_id`. Como as atividades de hoje (ENCERRAMENTO DE TURNO) não têm formulário vinculado, os envios não são registrados e o Dashboard mostra tudo zerado.

**Causa raiz**: A coluna `formulario_id` na tabela `cronograma_envios` é `NOT NULL`, impedindo insert sem formulário.

### Plano

1. **Migration**: Tornar `formulario_id` nullable na tabela `cronograma_envios`
   - `ALTER TABLE cronograma_envios ALTER COLUMN formulario_id DROP NOT NULL;`

2. **Edge Function**: Remover o `if (formularioId)` condicional e sempre registrar o envio
   - No `send-cronograma-messages/index.ts`, linhas 222-231: tirar o `if` e inserir sempre, passando `formulario_id: formularioId || null`

3. **Dashboard**: Ajustar `CronogramaDashboard` e `useCronogramaEnvios` para exibir envios sem formulário
   - O hook já funciona sem filtro de formulário, mas a UI mostra `e.formularios?.titulo || 'Formulário'` — ajustar para mostrar o título da atividade quando não há formulário vinculado
   - Fazer join com `cronograma_atividades(titulo)` no hook para exibir o nome da atividade

### Resultado
- Todos os envios (com ou sem formulário) serão registrados
- O Dashboard mostrará KPIs corretos de enviados/respondidos/pendentes
- Os envios futuros do cron a cada 15 min aparecerão automaticamente


## Objetivo
Ao marcar presença na aula experimental no card "Eventos de Hoje", garantir que o **nome do treinador** e a **confirmação de comparecimento** sejam salvos e exibidos claramente na ficha do aluno.

## Mudanças

### 1. Banco de dados (migration)
Adicionar coluna `treinador_experimental` (text, nullable) na tabela `leads`, para refletir o último treinador que ministrou a experimental do aluno (independente da interação).

### 2. `EventosHoje.tsx` — handleMarcarPresenca
Quando `tipoEvento === 'experimental'` e `checked === true`:
- Continuar atualizando `interacoes.compareceu = true` e `interacoes.treinador_experimental = <nome>` (já existe).
- **Novo:** também atualizar `leads.treinador_experimental = <nome>` para o lead correspondente.

### 3. `InteractionTimeline.tsx`
No grid de detalhes da interação, adicionar exibição de:
- **Treinador (Experimental):** mostra `int.treinador_experimental` quando presente (hoje só mostra `treinador_responsavel`, que é do fechamento).
- **Presença:** badge "✓ Compareceu" quando `int.compareceu === true` (atualmente não há indicador visual explícito na timeline).

### 4. Tipo `Lead` (src/types/database.ts)
Adicionar campo opcional `treinador_experimental?: string | null`.

## Detalhes técnicos
- A tabela `interacoes` já tem `treinador_experimental` e `compareceu` — sem mudança de schema lá.
- Migration apenas: `ALTER TABLE leads ADD COLUMN treinador_experimental text;`
- Após migration, types.ts é regenerado automaticamente.
- Nenhuma mudança em RLS (coluna nova herda políticas existentes da tabela `leads`).
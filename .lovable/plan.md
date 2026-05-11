# Incluir horário da experimental na notificação de anamnese

## O que muda
Na mensagem enviada ao grupo de WhatsApp quando uma anamnese é preenchida, exibir também o horário agendado da aula experimental, além da data.

Atualmente a linha mostra:
```
📅 Data da aula: 15/05/2026
```

Passará a mostrar:
```
📅 Data da aula: 15/05/2026 às 19:00
```

Quando não houver horário cadastrado, exibe apenas a data (sem o "às ...").

## Arquivo afetado
- `supabase/functions/notify-anamnese-experimental/index.ts`
  - Adicionar `hora_aula_experimental` ao `select` da tabela `leads`.
  - Formatar a hora com `.slice(0,5)` (HH:MM, evitando offset de timezone) e concatenar à `dataAula`.

## Não muda
- UI do CRM, formulário público de anamnese, schema de banco, RLS.
- Outras notificações (confirmação experimental, follow-ups) permanecem iguais.

Posso aplicar?
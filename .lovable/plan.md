

## Corrigir Notificações de Rotinas: Envio por Horário a Cada 15 Minutos

### Diagnóstico

Encontrei **dois problemas graves**:

1. **Cron roda 1x ao dia (13h Brasília)** — O job `notify-rotinas-diarias` está agendado em `0 16 * * 1-6` (16:00 UTC = 13:00 BRT). Rotinas com `horario_esperado` às 18:00 nunca recebem notificação no horário certo.

2. **Frequências incompatíveis** — O banco armazena frequências como `semanal:seg,ter,qua,qui,sex`, mas a função espera valores como `seg_a_sex` ou `diaria`. O parser não reconhece o formato real e faz fallback para "enviar sempre".

### Solução

Reescrever `notify-rotinas-diarias` no mesmo padrão do `send-cronograma-messages` (que já funciona corretamente a cada 15 min).

### Mudanças

**1. Criar tabela `rotina_notificacoes` para rastrear envios e evitar duplicatas**
```sql
CREATE TABLE rotina_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid REFERENCES rotinas(id) ON DELETE CASCADE,
  data_envio date NOT NULL,
  enviado_em timestamptz DEFAULT now(),
  status text DEFAULT 'enviado'
);
CREATE UNIQUE INDEX ON rotina_notificacoes (rotina_id, data_envio);
```

**2. Reescrever `notify-rotinas-diarias/index.ts`**
- Calcular hora Brasília atual (mesmo padrão do cronograma)
- Filtrar rotinas cujo `horario_esperado` está na janela de 15 min atual (-2 a +12 min)
- Corrigir parser de frequência para formato real (`semanal:seg,ter,qua,qui,sex`)
- Verificar tabela `rotina_notificacoes` para não duplicar envio no mesmo dia
- Registrar cada envio na tabela de rastreio

**3. Reagendar cron de 1x/dia para cada 15 minutos**
- Remover job `notify-rotinas-diarias-13h` (schedule `0 16 * * 1-6`)
- Criar job `notify-rotinas-every-15min` (schedule `*/15 * * * *`)

### Fluxo Resultante
```text
Cron a cada 15 min
  → Edge function calcula hora Brasília (ex: 18:02)
  → Busca rotinas com horario_esperado na janela 17:58–18:12
  → Filtra por frequência do dia (ex: semanal:seg,ter,qua,qui,sex → terça ✓)
  → Ignora já concluídas ou já notificadas hoje
  → Envia WhatsApp com botões ✅/❌
  → Registra em rotina_notificacoes
```

### Detalhes Técnicos
- Formato real de frequência no banco: `semanal:seg,ter,qua,qui,sex`, `semanal:sab,dom`, `semanal:sex`, `semanal:seg`
- Mapeamento de dia: `seg=1, ter=2, qua=3, qui=4, sex=5, sab=6, dom=0`
- Janela de envio: mesma lógica do cronograma (`-2 a +12 min`)
- RLS na nova tabela: acesso para `authenticated` (leitura)



# Plano: Simplificar Tarefas + Notificações Automáticas de Prazo

## Resumo
Remover o campo "Setor", adicionar "Horário" ao prazo, e implementar notificações WhatsApp automáticas 24h antes e no momento do prazo.

---

## 1. Alterações no Banco de Dados

### Modificar tabela `tasks`:
- **Remover obrigatoriedade** do campo `setor` (tornar nullable com default vazio)
- **Adicionar coluna** `hora_prazo` (TIME, nullable) para horário específico
- **Adicionar colunas de controle** para notificações:
  - `notificado_24h` (BOOLEAN, default false)
  - `notificado_prazo` (BOOLEAN, default false)

---

## 2. Criar Edge Function de Notificação por Cron

**Nova função**: `notify-task-deadlines`

Lógica:
```text
1. Buscar tarefas com prazo nas próximas 24h onde notificado_24h = false
2. Para cada tarefa, enviar WhatsApp: "Lembrete: tarefa X vence amanhã às HH:MM"
3. Marcar notificado_24h = true

4. Buscar tarefas com prazo agora (ou há pouco) onde notificado_prazo = false
5. Para cada tarefa, enviar WhatsApp: "Prazo final: tarefa X vence AGORA"
6. Marcar notificado_prazo = true
```

Agendamento via pg_cron: executar a cada 15 minutos

---

## 3. Atualizar Interface (Modal de Tarefa)

### Antes:
```text
[ Responsável ] [ Setor      ]
[ Prioridade  ] [ Prazo      ]
```

### Depois:
```text
[ Responsável ]
[ Prioridade  ] [ Prazo + Horário ]
```

- Remover campo Setor do formulário
- Adicionar seletor de horário ao lado do calendário de prazo

---

## 4. Atualizar Componentes Visuais

### TarefaCard:
- Remover badge de Setor
- Exibir horário junto com a data quando definido (ex: "15 de Fev às 14:00")

### TarefasFilters:
- Remover filtro por Setor

### TarefasKPIGrid:
- Se houver KPI por setor, remover

---

## 5. Atualizar Hook e Types

### useTarefasData.ts:
- Remover `SETORES` das constantes exportadas
- Atualizar interface `Task` com `hora_prazo`
- Atualizar `TaskInsert` sem setor obrigatório

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/tarefas/TarefaModal.tsx` | Remover setor, adicionar hora |
| `src/components/tarefas/TarefaCard.tsx` | Remover badge setor, exibir hora |
| `src/components/tarefas/TarefasFilters.tsx` | Remover filtro setor |
| `src/hooks/useTarefasData.ts` | Atualizar types e remover SETORES |
| `supabase/functions/notify-task-deadlines/index.ts` | **Criar** - cron de notificações |

---

## Seção Técnica

### SQL Migration
```sql
-- Tornar setor opcional
ALTER TABLE tasks ALTER COLUMN setor DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN setor SET DEFAULT '';

-- Adicionar hora do prazo
ALTER TABLE tasks ADD COLUMN hora_prazo TIME;

-- Controle de notificações enviadas
ALTER TABLE tasks ADD COLUMN notificado_24h BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN notificado_prazo BOOLEAN DEFAULT false;
```

### Cron Job (pg_cron)
```sql
SELECT cron.schedule(
  'notify-task-deadlines',
  '*/15 * * * *',  -- A cada 15 minutos
  $$ SELECT net.http_post(...) $$
);
```

### Fluxo de Notificações WhatsApp
```text
+------------------+     +-------------------+     +-------------------+
| Criar Tarefa     | --> | WhatsApp: Nova    | --> | notificado_24h=F  |
|                  |     | tarefa atribuída  |     | notificado_prazo=F|
+------------------+     +-------------------+     +-------------------+
         |
         v (Cron a cada 15min)
+------------------+     +-------------------+
| Prazo em 24h?    | --> | WhatsApp: Vence   |
| notificado_24h=F |     | amanhã às HH:MM   |
+------------------+     +-------------------+
         |
         v
+------------------+     +-------------------+
| Prazo agora?     | --> | WhatsApp: Prazo   |
| notificado_prazo=F     | final AGORA!      |
+------------------+     +-------------------+
```

---

## Resultado Esperado

- Interface mais simples (sem setor)
- Prazo com data + horário específico
- 3 notificações automáticas por tarefa:
  1. Ao criar (já existe)
  2. 24h antes do prazo
  3. No momento do prazo

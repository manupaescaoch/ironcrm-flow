## Plano: CRM Iron Club — WhatsApp → Lead → Matrícula → Dashboard

Reaproveita 100% das estruturas existentes (tabela `leads`, `interacoes`, `is_matriculado`, páginas `/crm`, `/kanban`, `/dashboard`, agente `agente_atendimentos`/`agente_mensagens`). Sem páginas paralelas, sem tabela `alunos` nova, sem `crm_leads`.

---

### 1. Renomear unidades

Migration (UPDATE em `public.unidades`):
- `Iron Zona Norte` → `Iron Madalena`
- `Iron Zona Sul` → `Iron Boa Viagem`

IDs preservados. Tudo (leads, interações, follow-ups, comissões, escala, estoque, dashboards) continua funcionando porque referenciam `unidade_id`.

Refator de strings hardcoded:
- `src/contexts/UnidadeContext.tsx`, `src/components/UnidadeSelector.tsx`, abas e títulos do dashboard, blocos do `resumo-semanal-webhook-resposta` (`Zona Norte` / `Zona Sul` / `ZN` / `ZS`).
- Memórias atualizadas para refletir os novos nomes.

---

### 2. Evoluir tabela `leads` (migration)

Adicionar colunas (sem quebrar nada existente):
- `telefone_normalizado text` + índice único parcial `(telefone_normalizado, unidade_id) WHERE ativo`
- `fonte text` (default `WHATSAPP`) — separa "origem" (categoria de marketing) de "fonte" (canal de captura)
- `status_conversa text` — `aguardando_resposta`, `respondido`, `em_andamento`, `urgente`, `encerrado`
- `ultima_interacao_at timestamptz`
- `valor_pipeline numeric(10,2)` (opcional, default 0)
- `convertido_em_aluno_at timestamptz`
- `atendimento_id uuid` referenciando `agente_atendimentos(id)` (vincula conversa)

Trigger BEFORE INSERT/UPDATE: popula `telefone_normalizado` a partir de `telefone` (remove `() - + espaços` via regexp_replace).

Status do funil: mapeamento de display (sem alterar enum atual para não quebrar follow-ups/dashboard):
- `novo` → "Novo lead"
- `aula_agendada` → "Agendado"
- `aula_realizada` → "Compareceu"
- `follow_up` → "Em atendimento"
- `negociacao` → "Negociação"
- `convertido` → "Matriculado"
- `perdido` → "Perdido"

---

### 3. Ingestão automática via WhatsApp

Nova edge function `whatsapp-inbound-webhook` (verify_jwt=false, com `x-webhook-secret` igual ao padrão de `rotina-whatsapp-response`):

1. Recebe payload Z-API (`phone`, `senderName`, `text.message`, `instanceId`).
2. Normaliza o telefone.
3. Busca em `leads` por `telefone_normalizado` (qualquer unidade).
4. **Se existir lead** com `is_matriculado=true` (aluno): apenas registra mensagem em `agente_mensagens` vinculada ao atendimento; atualiza `ultima_interacao_at` e `status_conversa='respondido'` se mensagem é da equipe (`fromMe`) ou `aguardando_resposta` se é do lead.
5. **Se existir lead** comum: idem (sem criar duplicado), atualiza `ultima_interacao_at` e `status_conversa`.
6. **Se não existir**: cria lead com `nome = senderName || 'WhatsApp ' + phone`, `telefone`, `origem='WHATSAPP'`, `fonte='WHATSAPP'`, `unidade_id = NULL`-equivalente (ver §4), `status_funil='novo'`, `status_conversa='aguardando_resposta'`, `ultima_interacao_at = now()`, `created_by = NULL`.
7. Cria/atualiza `agente_atendimentos` + `agente_mensagens` referenciando o `lead_id`.

Idempotência: usa `external_message_id` da Z-API para deduplicar mensagens.

---

### 4. Unidade "Não definida"

A coluna `leads.unidade_id` hoje é NOT NULL com default `Iron Zona Norte`. Opções:
- **Solução escolhida**: criar uma terceira unidade `Iron — Não definida` (UUID fixo) para representar "sem unidade". Mantém a constraint NOT NULL e todas as RLS por `unidade_id` continuam intactas.
- Tornar admin a única role com acesso via `user_unidades` a essa unidade (coordenadores/comercial não veem).
- No frontend, rótulo amigável: "Não definida".

Webhook usa esse UUID quando cria lead novo. Drawer do lead permite trocar para Madalena ou Boa Viagem.

---

### 5. Página CRM (`/crm`) — evolução

- Adicionar coluna/filtro **Unidade** com opções: Todas / Madalena / Boa Viagem / Não definida (esta só visível para admin).
- Adicionar filtro **Status da conversa** e **Fonte**.
- Tabela: nova coluna "Última interação" e badge de status_conversa.
- Botão de toggle Tabela ↔ Kanban (reutiliza `/kanban`).

### 6. Página Kanban (`/kanban`) — evolução

- Renomear labels das colunas conforme mapeamento §2.
- Cada card mostra: nome, telefone, unidade, fonte, responsável, última interação, valor em pipeline.

### 7. Página LeadDetail (`/lead/:id`) — evolução

- Exibir status da conversa, fonte, atendimento_id, histórico de mensagens (`agente_mensagens` por `atendimento_id`).
- Botão **Alterar unidade de destino** (Madalena / Boa Viagem / Não definida).
- Botão **Abrir conversa no WhatsApp** (`https://wa.me/<telefone>`).
- Botão **Tornar aluno** — abre modal de matrícula.

### 8. Modal "Tornar aluno"

Pré-preenche nome/telefone/unidade do lead. Campos: plano, data início, data vencimento (auto-calculada por plano), valor, forma de pagamento, responsável venda, observações.

Ao confirmar:
1. Valida que não existe outro lead `is_matriculado=true` com o mesmo `telefone_normalizado`.
2. Insere `interacoes` com `fechou_matricula=true`, `plano_fechado`, `valor_plano`, `data_fechamento`, `forma_pagamento`, `responsavel_fechamento`.
3. Atualiza lead: `status_funil='convertido'`, `is_matriculado=true`, `convertido_em_aluno_at=now()`.
4. Trigger existente (`cancel_follow_ups_on_status_change`) cancela follow-ups pendentes.
5. Comissão é calculada pelas regras já existentes (3% cadastrador + 2% fechador).

Botão só aparece se `is_matriculado=false`.

---

### 9. Dashboard (`/dashboard`) — evolução

Filtros no topo: **Período** (Hoje, Ontem, 7d, 30d, Este mês) + **Unidade** (Todas, Madalena, Boa Viagem, Não definida).

Linha 1 — 6 cards:
1. Mensagens recebidas (count `agente_mensagens` role=user no período)
2. Conversas ativas (count `agente_atendimentos` com `ultima_interacao_at` no período)
3. Chats sem resposta (leads com `status_conversa='aguardando_resposta'`)
4. Tempo médio de resposta (avg diff entre mensagem do lead e próxima `fromMe`)
5. Leads no período (count `leads.created_at`)
6. Valor em pipeline (sum `valor_pipeline` em status não-final)

Linha 2 — cards extras: Matrículas, Taxa de conversão, Agendamentos, Comparecimentos, Perdidos.

Card grande "Atividade": line chart com mensagens/leads/matrículas por dia.

Card "Fontes de Leads": donut por `fonte` + lista com count + percentual.

Cada card mostra delta % vs período anterior (regras de inversão para tempo médio e chats sem resposta).

Estados vazios amigáveis. Permissões: admin vê todas as unidades + "Não definida"; demais veem apenas suas unidades (já garantido por RLS).

---

### 10. Sidebar

- Renomear "CRM" → "Funil de Vendas" (mesma rota `/crm`).
- Renomear "Dashboard" → "Painel de Dados" (mesma rota `/dashboard`).
- Sem novos itens — "Contatos" e "Alunos" do briefing são contemplados por Funil de Vendas (com filtro `is_matriculado`).

---

### Detalhes técnicos

- **Migration** única com: rename de unidades; nova unidade "Não definida"; novas colunas em `leads`; índice de telefone normalizado; trigger de normalização; policy em `user_unidades` para escopo de "Não definida"; (opcional) ENABLE realtime para `agente_mensagens` se quiser histórico ao vivo no drawer.
- **Edge function** `whatsapp-inbound-webhook` com validação `x-webhook-secret` antes de ler body (padrão já adotado nas funções de webhook).
- **Tipos**: regenerados após migration (`src/integrations/supabase/types.ts` auto-gerado).
- **Frontend**: novos hooks `useDashboardKPIs`, `useFontesLeads`, `useTimelineAtividade`; reutilizar `useUnidade` (já existe) e estender contexto para suportar "Não definida" com permissionamento por role.
- **Sem nova tabela `alunos`**: bot "Tornar aluno" usa a tabela `interacoes` que já tem todos os campos de matrícula (`plano_fechado`, `valor_plano`, `data_fechamento`, `forma_pagamento`, `responsavel_fechamento`).
- **Sem tabela `crm_leads`**: tudo segue em `public.leads`.

### Não inclui (fora de escopo até confirmar)

- Conectar a Z-API real ao webhook (precisa de URL final + secret cadastrado pelo time).
- Backfill de `telefone_normalizado` para leads já existentes (faço junto à migration se quiser, é seguro).
- Página separada de "Contatos" (assumido coberto pelo Funil com filtro).

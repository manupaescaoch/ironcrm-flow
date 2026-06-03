## Objetivo

Unificar tudo na página `/crm` (Funil de Vendas). Remover a página/rota `/conversas-whatsapp` e o item correspondente no menu lateral. As conversas do WhatsApp passam a viver como uma seção dentro do próprio Funil, entre os KPIs e a lista/kanban de leads.

## Ordem visual final em `/crm`

1. Cabeçalho — título "Funil de Vendas", subtítulo "Gestão dos leads e conversas recebidas pelo WhatsApp"
2. Filtros existentes (período, unidade, exportar, novo lead, importar planilha) — mantidos como estão
3. KPIs (cards existentes + 3 novos)
4. Seção **Conversas do WhatsApp**
5. Lista/Kanban de leads (como está hoje)

## 1. KPIs — adicionar 3 cards

Manter os KPIs atuais e somar:

- **Conversas WhatsApp** — total de `agente_atendimentos` no período/unidade selecionados
- **Não vinculadas** — `agente_atendimentos` com `lead_id IS NULL` e `status != 'arquivado'`
- **Sem resposta** — `agente_atendimentos` cuja última mensagem em `agente_mensagens` tem `role = 'user'` (i.e. ainda não respondemos)

Todos respeitam o filtro de período e unidade já usado pela página.

## 2. Nova seção "Conversas do WhatsApp"

Componente novo `src/components/crm/ConversasWhatsAppSection.tsx`, renderizado logo abaixo do bloco de KPIs em `src/pages/CRM.tsx`.

Conteúdo:

- Título "Conversas do WhatsApp" + subtítulo "Números recebidos pelo WhatsApp ainda não vinculados ou em processo de qualificação"
- Tabs/segmento: **Não vinculadas** (padrão) | **Vinculadas** | **Todas**
- Busca por nome / telefone / trecho de mensagem
- Botão "Atualizar" + realtime via `postgres_changes` em `agente_atendimentos` e `agente_mensagens`
- Lista (limit ~50, com "Ver mais") onde cada item mostra:
  - Nome (ou últimos 4 dígitos do telefone)
  - Telefone
  - Última mensagem (preview)
  - Data/hora da última interação (`formatDistanceToNow` pt-BR)
  - Unidade (badge)
  - Status da conversa
  - Badge: **Não vinculado** / **Vinculado** / **Lead criado** (quando `lead_id` aponta para lead `is_matriculado=false`/`true`)
  - Botão **Ver conversa** → reaproveita o `Sheet` de histórico
  - Botão **Transformar em Lead** (oculto se já vinculado)
  - Ícone **Arquivar** (admin)

## 3. Modal "Transformar em Lead"

Reaproveita a lógica que já existe em `ConversasWhatsApp.tsx`, com 1 campo a mais conforme pedido:

- Nome (pré-preenchido, uppercase)
- Telefone (readonly)
- Unidade de destino (default = unidade ativa)
- Fonte = WHATSAPP (fixo)
- **Responsável** (novo) — Select com usuários da unidade, default = usuário logado → grava em `leads.responsavel_id` / `cadastrado_por`
- **Observação** (novo, opcional) — textarea; se preenchido, cria uma `lead_interactions` com tipo "observacao"

Ao confirmar:
1. Verifica duplicidade por `telefone_normalizado` (ativo). Se existir → apenas vincula `agente_atendimentos.lead_id`.
2. Senão `INSERT INTO leads` com `fonte='WHATSAPP'`, `status_funil='novo'`, `status_conversa='aguardando_resposta'`, `unidade_id`, `created_by`, `responsavel_id`.
3. `UPDATE agente_atendimentos SET lead_id, unidade_id WHERE id`.
4. Invalida queries do funil e KPIs → lead aparece imediatamente na lista/kanban abaixo e os KPIs recalculam.

## 4. Navegação

- `src/App.tsx` → remover a rota `/conversas-whatsapp` e o import de `ConversasWhatsApp`.
- `src/components/Layout.tsx` → remover o item "Conversas WhatsApp" do sidebar e o badge de contagem.
- Manter no menu apenas: Painel de Dados, Funil de Vendas e os demais já existentes.
- Deletar `src/pages/ConversasWhatsApp.tsx` (toda a UI vira parte do CRM).

## 5. Arquivos

**Novos**
- `src/components/crm/ConversasWhatsAppSection.tsx` — seção principal
- `src/components/crm/ConversaHistoricoSheet.tsx` — drawer de histórico
- `src/components/crm/TransformarEmLeadModal.tsx` — modal (com Responsável + Observação)
- `src/hooks/useConversasWhatsApp.ts` — fetch + realtime + filtros por período/unidade

**Editados**
- `src/pages/CRM.tsx` — montar a nova ordem (Cabeçalho → Filtros → KPIs → Conversas → Lista/Kanban) e passar período/unidade
- `src/hooks/useDashboardStats.ts` (ou o hook de KPIs do CRM) — adicionar os 3 KPIs novos
- `src/App.tsx` — remover rota
- `src/components/Layout.tsx` — remover item do sidebar

**Removidos**
- `src/pages/ConversasWhatsApp.tsx`

## Detalhes técnicos

- Webhook `whatsapp-inbound-webhook` permanece igual: continua **não criando lead automaticamente**, só `agente_atendimentos` + `agente_mensagens`. Toda criação de lead é manual via o modal.
- RLS atual de `agente_atendimentos`/`agente_mensagens` já cobre o uso (admin + usuários com a unidade vinculada).
- Sem migrations novas. Nenhuma alteração de schema.

## Fora de escopo

- Enviar mensagens de saída pelo CRM (continua leitura).
- Anexos (imagem/áudio).
- Mudar a lógica do webhook ou dos KPIs já existentes.

## Mudança principal

O webhook **para de criar lead automaticamente**. Toda mensagem nova entra como **conversa pendente** na caixa "WhatsApp — Não atribuídas". Só vira lead quando alguém clicar manualmente em **"Transformar em Lead"**.

---

## 1. Refatorar `whatsapp-inbound-webhook`

Novo comportamento por telefone recebido:

- **Telefone já vinculado a um lead ativo** → mesma lógica de hoje: atualiza `ultima_interacao_at`, `status_conversa`, grava mensagem em `agente_mensagens`. Nada muda no funil.
- **Telefone NÃO encontrado em `leads`** → **não cria lead**. Apenas:
  - Cria/atualiza um registro em `agente_atendimentos` com `unidade_id = Iron Setúbal` (caixa de entrada), `lead_id = NULL`, `nome = senderName`, `telefone`, `status = 'novo'`.
  - Grava a mensagem em `agente_mensagens` com dedupe por `external_message_id`.
- Mantém: validação `x-webhook-secret` em tempo constante, ignora grupos e status, normaliza telefone.

Pequeno ajuste técnico: como `agente_atendimentos.agente_id` é NOT NULL, usar o 1º agente da unidade Setúbal; se não houver, criar um agente "Caixa de entrada — WhatsApp" via seed (1 vez) na migration.

## 2. Nova página `/conversas-whatsapp` (Caixa de Entrada)

Lista todos os `agente_atendimentos` **com `lead_id IS NULL`** ordenados por `ultima_interacao_at desc`. Cada linha mostra:

- Nome (ou telefone), prévia da última mensagem, tempo desde a última interação.
- Botão **"Ver conversa"** → abre drawer com histórico (`agente_mensagens`).
- Botão **"Transformar em Lead"** → modal com:
  - Nome (pré-preenchido), telefone (readonly), unidade (default Setúbal), origem (default WHATSAPP).
  - Ao confirmar: cria lead + faz `UPDATE agente_atendimentos SET lead_id = ... WHERE id = ...`. A conversa some da caixa de entrada e passa a aparecer no Funil/Lead detail.
- Botão **"Arquivar"** (admin) → marca `status = 'arquivado'` e some da lista.

## 3. Sidebar

Adicionar item **"Conversas WhatsApp"** logo abaixo de **Funil de Vendas**, com badge mostrando contagem de conversas sem lead.

## 4. Testar o webhook

Antes de pedir para apontar a Z-API, eu rodo `curl_edge_functions` com 3 payloads simulando Z-API e o header `x-webhook-secret` correto:

1. Telefone novo (deve criar apenas atendimento + mensagem, **sem lead**).
2. Mesmo telefone, 2ª mensagem (deve reusar o atendimento e gravar nova mensagem).
3. Telefone de um lead existente (deve atualizar `ultima_interacao_at` do lead, sem criar nada novo).

E também valido:
- POST sem `x-webhook-secret` → 401.
- POST com `isGroup=true` → 200 ignorado.
- Re-envio com o mesmo `messageId` → deduplicado.

Mostro o resultado de cada chamada (lead_id, atendimento_id, status).

## 5. Detalhes técnicos

- **Tabelas**: nenhuma nova. Só uso `agente_atendimentos` (`lead_id` já é nullable) e `agente_mensagens`. Migration mínima só para seed do agente "Caixa de entrada" da unidade Setúbal, caso não exista.
- **RLS**: as policies atuais de `agente_atendimentos`/`agente_mensagens` já cobrem (admin + user com unidade vinculada). Como a caixa vive na unidade Setúbal, admins veem tudo; outros usuários só veem se tiverem Setúbal vinculada.
- **Funil**: continua lendo apenas de `leads`. Nada muda na página `/crm`, exceto que leads vindos por WhatsApp agora só aparecem após ação manual.
- **Arquivos novos**: `src/pages/ConversasWhatsApp.tsx`, `src/components/conversas/ConversaItem.tsx`, `src/components/conversas/TransformarEmLeadModal.tsx`, hook `useConversasInbox.ts`. Rota em `src/App.tsx`. Item no sidebar `src/components/Layout.tsx`.
- **Arquivos editados**: `supabase/functions/whatsapp-inbound-webhook/index.ts` (remove o ramo de criação automática de lead).

## Fora de escopo

- Enviar mensagem de saída pelo CRM (apenas leitura por enquanto).
- Anexos (imagem/áudio) — só texto nesta etapa.

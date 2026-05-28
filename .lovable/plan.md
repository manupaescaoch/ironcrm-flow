# Redirecionar notificações WhatsApp por unidade

Hoje 3 funções enviam para destino errado (grupo legado ou direto ao lead). Vamos redirecionar cada uma para o canal interno correto da unidade.

## 1. `notify-anamnese-experimental` → grupo da unidade (novos IDs)

Atualizar os secrets já existentes para os novos grupos:
- `WHATSAPP_GRUPO_ANAMNESE_ZN` = `120363423846997807-group`
- `WHATSAPP_GRUPO_ANAMNESE_ZS` = `120363419881143524-group`

Nenhuma alteração de código — a função já roteia por unidade lendo esses secrets. Apenas confirmar e atualizar os valores no painel de Secrets.

## 2. `notify-feedback-experimental` → recepção da unidade

Hoje envia para `lead.telefone`. Vamos:
- Buscar `lead.unidade_id` junto com o lead.
- Buscar `telefone_recepcao` em `unidade_whatsapp_config` (mesma tabela usada por `send-confirmacao-recepcao`) filtrando por `unidade_id` e `ativo = true`.
- Enviar a mensagem para o telefone da recepção daquela unidade (já normalizado).
- Reformular o texto como **notificação interna** (não é mais mensagem direta ao lead). Exemplo:

  ```
  📞 *Feedback pós-aula experimental*

  Lead: {nome}
  Telefone: {telefone formatado}
  Aula: hoje, {hora}
  
  Entrar em contato para coletar feedback e oferecer o plano.
  ```

- Manter o `update` em `feedback_pos_aula_enviado_em` e o cancelamento do D+1 (a lógica de evitar duplicidade continua válida).
- Se a unidade não tiver `telefone_recepcao` configurado, logar warning e marcar como erro (não enviar).

## 3. `notify-boas-vindas-matricula` → recepção da unidade

Mesma estratégia da #2:
- Buscar `unidade_id` do lead.
- Resolver `telefone_recepcao` via `unidade_whatsapp_config`.
- Reformular para notificação interna:

  ```
  🎉 *Nova matrícula*

  Aluno: {nome}
  Telefone: {telefone formatado}
  Fechada há: 2h
  
  Enviar boas-vindas e iniciar onboarding.
  ```

- Manter `boas_vindas_enviada_em` para idempotência.

## Notas técnicas

- Tabela usada: `unidade_whatsapp_config (unidade_id, telefone_recepcao, ativo)`.
- Z-API: continua `send-text` com `phone` = telefone da recepção (sufixo `-group` apenas para o caso #1).
- Sem mudanças de schema, RLS ou migrations.
- Sem mudanças no frontend.

## Pós-deploy

Testar com `dry_run: true` (#2 e #3 já suportam) para validar destino antes de liberar envios reais.

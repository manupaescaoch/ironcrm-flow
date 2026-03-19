

# Confirmação de Rotinas via WhatsApp com Botões

## Status: ✅ Implementado

## O que foi feito

### 1. `notify-rotinas-diarias` (atualizado)
- Agora envia **uma mensagem por rotina** (não mais consolidada) usando `send-button-list` da Z-API
- Cada mensagem tem 2 botões: "✅ Feito" (`feito_<rotina_id>`) e "❌ Não feito" (`naofeito_<rotina_id>`)
- Inclui nome da unidade, setor, horário e atividades

### 2. `rotina-whatsapp-response` (novo)
- Edge function que recebe o webhook da Z-API quando um botão é clicado
- Identifica o responsável pelo número de telefone (busca em user_profiles + auth.users)
- Extrai o `rotina_id` do `buttonId` do payload
- Insere/atualiza `rotina_execucoes` com `concluida=true/false` e `concluida_por = "Nome (via WhatsApp)"`
- Envia mensagem de confirmação de volta ao usuário
- `verify_jwt = false` no config.toml (webhook externo)

## Configuração necessária na Z-API

Configure o webhook de recebimento (on-message-received) no painel Z-API para:
```
https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/rotina-whatsapp-response
```

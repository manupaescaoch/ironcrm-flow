
## Plano: Remover botões e enviar notificação de rotina como texto simples

**Problema**: A função `notify-rotinas-diarias` usa `send-button-list` da Z-API. Botões interativos frequentemente são bloqueados pelo WhatsApp/Z-API quando o destinatário não tem interação prévia, resultando em mensagens marcadas como "enviadas" mas que não chegam.

**Solução**: Trocar `send-button-list` por `send-text` (texto simples).

### Mudanças

**Arquivo: `supabase/functions/notify-rotinas-diarias/index.ts`**

1. Trocar endpoint `send-button-list` por `send-text`
2. Trocar payload `{ phone, message, buttonList: {...} }` por `{ phone, message }`
3. Adicionar instrução textual no final da mensagem orientando o responsável a marcar manualmente no sistema (já que não haverá botões)
4. Logar resposta completa da Z-API (status + body) para auditoria futura
5. Marcar status `falhou` em `rotina_notificacoes` quando Z-API retornar erro (em vez de só logar)

### Mensagem final (exemplo)
```
📋 *Rotina Pendente*
📍 *Iron Zona Sul*
📅 17/04/2026

🔹 *ABERTURA* (Recepção) - 06:00
• Ligar luzes (06:00)
• Verificar limpeza

✅ Marque como concluída no sistema CRM após executar.
```

### Deploy
Após a edição, fazer deploy de `notify-rotinas-diarias` e disparar manualmente com `force_hour` para validar entrega aos responsáveis (Danubia, Aylana, Marcelo).

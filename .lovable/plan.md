
User wants to remove the instruction "✅ Marque como concluída no sistema CRM após executar." since the message is purely a reminder — no need to mark as done.

## Plano: Simplificar mensagem de rotina (apenas lembrete)

**Arquivo**: `supabase/functions/notify-rotinas-diarias/index.ts`

**Mudança única**: Remover a linha final que pede para marcar como concluída no sistema. A mensagem termina após a lista de atividades.

### Mensagem final (exemplo)
```
📋 *Rotina Pendente*
📍 *Iron Zona Sul*
📅 17/04/2026

🔹 *ABERTURA* (Recepção) - 06:00
• Ligar luzes (06:00)
• Verificar limpeza
```

### Deploy
Redeploy da função `notify-rotinas-diarias` após edição.

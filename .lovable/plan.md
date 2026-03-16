

## Confirmação de Rotinas via WhatsApp com Botões

### Resumo
Sim, é possível. A Z-API suporta envio de mensagens com botões interativos. O fluxo seria:

1. A mensagem das 13h já enviada passa a incluir botões "✅ Feito" e "❌ Não feito" para cada rotina
2. Quando o responsável clica no botão, a Z-API envia um webhook de volta
3. Uma nova edge function recebe esse webhook e registra a confirmação no banco de dados

### Fluxo Técnico

```text
[13:00 Cron] → notify-rotinas-diarias
    → Envia msg com botões via Z-API (send-button-list)
    → Botões: "✅ Feito" (id=rotina_id) / "❌ Não feito"

[Responsável clica botão no WhatsApp]
    → Z-API Webhook → POST /rotina-whatsapp-response
    → Edge function identifica rotina + telefone
    → Atualiza rotina_execucoes (concluida=true/false)
    → Responde ao usuário: "✅ Rotina X marcada como concluída!"
```

### Alterações necessárias

**1. Nova edge function: `rotina-whatsapp-response`**
- Recebe webhook da Z-API quando um botão é clicado
- Identifica o responsável pelo telefone (busca em user_profiles + auth.users)
- Extrai o `rotina_id` do `buttonId` do payload
- Insere/atualiza `rotina_execucoes` com `concluida=true` e `concluida_por` = nome do usuário
- Responde via Z-API confirmando o registro
- Configurar `verify_jwt = false` no config.toml (webhook externo)

**2. Atualizar `notify-rotinas-diarias`**
- Trocar de `send-text` para `send-button-list` da Z-API
- Enviar uma mensagem por rotina (não consolidada) para que cada botão identifique a rotina específica
- Formato do botão: `{ id: rotina_id, label: "✅ Feito" }`

**3. Configuração na Z-API**
- O webhook de recebimento da Z-API precisa ser configurado no painel Z-API para apontar para:
  `https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/rotina-whatsapp-response`

### Limitações importantes
- Botões do WhatsApp só podem ser clicados **uma vez** pelo usuário
- WhatsApp limita a **3 botões** por mensagem
- Se houver muitas rotinas, cada uma será enviada como mensagem separada com seus botões

### Dados armazenados
A tabela `rotina_execucoes` já existe e será usada para guardar:
- `concluida = true/false`
- `concluida_por = "Nome (via WhatsApp)"`
- `concluida_em = timestamp`
- `data_execucao = hoje`


## Nova arquitetura de envio (corrigida pelo usuário)

| Tipo | Destino | Chip |
|---|---|---|
| Confirmação experimental (24h e 2h antes) | **Telefone do lead** | Comercial |
| Follow-up (D+1/D+7/D+15/D+30) | **Telefone do lead** | Comercial |
| Respostas de anamnese | **Grupo da unidade** | Comercial |

Isso **revoga** a regra core anterior que dizia "chip nunca manda direto ao lead". A nova regra: confirmação e FU vão direto ao aluno; só anamnese vai pro grupo.

## Bug 1 — Cron está chamando a função certa, mas ela estava silenciosa

`confirmacao-experimental-cada-15min` chama `confirmacao-experimental-automatica`, que já envia direto ao lead pelo chip comercial. **Manter assim.** O motivo de não ter saído nada desde 31/05 é o Bug 2 abaixo + o guard `phoneExists` falhando porque o token estava errado.

Ações:
- **Não trocar** o cron para `send-confirmacao-recepcao`.
- Marcar `send-confirmacao-recepcao` como descontinuada (comentário no topo do arquivo) para evitar uso futuro acidental.

## Bug 2 — Mistura de credenciais (instance comercial + token legado)

Quatro funções carregam o `ZAPI_INSTANCE_ID` da comercial mas o `ZAPI_TOKEN` / `ZAPI_CLIENT_TOKEN` da instância legada. Como instance + token precisam casar na Z-API, isso gera `{"error":"Instance not found"}` — exatamente o erro nos logs de `notify-feedback-experimental` e `notify-boas-vindas-matricula` em 02/06. Também faz o `phoneExists` da confirmação retornar `false`, bloqueando todos os envios silenciosamente.

Padrão atual (errado):
```
ZAPI_INSTANCE_ID  = ZAPI_COMERCIAL_INSTANCE_ID ?? ZAPI_INSTANCE_ID
ZAPI_TOKEN        = ZAPI_TOKEN                     // legacy
ZAPI_CLIENT_TOKEN = ZAPI_CLIENT_TOKEN              // legacy
```

Padrão correto (já usado em `notify-anamnese-experimental`):
```
ZAPI_INSTANCE_ID  = ZAPI_COMERCIAL_INSTANCE_ID  ?? ZAPI_INSTANCE_ID
ZAPI_TOKEN        = ZAPI_COMERCIAL_TOKEN        ?? ZAPI_TOKEN
ZAPI_CLIENT_TOKEN = ZAPI_COMERCIAL_CLIENT_TOKEN ?? ZAPI_CLIENT_TOKEN
```

Funções a corrigir:
- `supabase/functions/send-fu-digest-comercial/index.ts`
- `supabase/functions/notify-feedback-experimental/index.ts`
- `supabase/functions/notify-boas-vindas-matricula/index.ts`
- `supabase/functions/send-confirmacao-recepcao/index.ts` (mesmo descontinuada, deixar consistente)

OK e não serão tocadas:
- `notify-anamnese-experimental` (padrão correto, envia ao grupo da unidade)
- `confirmacao-experimental-automatica`, `send-follow-ups-automaticos` (usam `getZapiCreds('comercial')` no helper, que já compõe instance+token+client_token coerentes)

## Atualização de memória

Substituir a regra core atual:
> "Z-API chip never messages leads directly. FU → grupo comercial da unidade; Confirmação experimental → telefone da recepção."

Por:
> "Confirmação experimental (24h/2h) e FU (D+1/D+7/D+15/D+30) → telefone do lead, chip comercial. Respostas de anamnese → grupo da unidade, chip comercial."

Atualizar também as memórias detalhadas referenciadas:
- `mem://features/whatsapp-comercial-architecture`
- `mem://features/confirmacao-experimental-automatica`
- `mem://features/follow-ups-automation`
- `mem://features/whatsapp-chip-protection` (manter rate limit, status check, phone-exists)

## Validação

1. Disparar `confirmacao-experimental-automatica` manualmente — esperar envios bem-sucedidos para os leads de hoje/amanhã na janela.
2. Disparar `notify-feedback-experimental` num caso recente — confirmar que `{"error":"Instance not found"}` desapareceu.
3. Conferir `whatsapp_envios_log` com `sucesso=true, canal=comercial, tipo_destino=lead` nas próximas execuções.

## Fora do escopo

Nada de UI, RLS, schema, templates, ou novos crons.

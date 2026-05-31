# Separação Z-API: Iron Comercial × Iron Operacional

Hoje todas as Edge Functions leem um único set de secrets (`ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`). Vamos introduzir dois sets de credenciais e roteá-los por **canal** (`comercial` / `operacional`), classificando cada função pelo seu propósito real.

## 1. Novos secrets (Lovable Cloud)

Adicionar via `add_secret`:

- `ZAPI_COMERCIAL_INSTANCE_ID`, `ZAPI_COMERCIAL_TOKEN`, `ZAPI_COMERCIAL_CLIENT_TOKEN`
- `ZAPI_OPERACIONAL_INSTANCE_ID`, `ZAPI_OPERACIONAL_TOKEN`, `ZAPI_OPERACIONAL_CLIENT_TOKEN`

Manter os secrets atuais (`ZAPI_INSTANCE_ID`/`ZAPI_TOKEN`/`ZAPI_CLIENT_TOKEN`) por enquanto como **fallback** durante a migração. Em uma segunda fase eles serão removidos.

## 2. Helper compartilhado (`supabase/functions/_shared/zapi.ts`)

Refatorar `getZapiCreds()` para aceitar um canal:

```ts
export type ZapiChannel = 'comercial' | 'operacional';

export function getZapiCreds(channel: ZapiChannel): ZapiCreds | null {
  const prefix = channel === 'comercial' ? 'ZAPI_COMERCIAL_' : 'ZAPI_OPERACIONAL_';
  const instanceId = Deno.env.get(prefix + 'INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID');
  const token      = Deno.env.get(prefix + 'TOKEN')       ?? Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get(prefix + 'CLIENT_TOKEN') ?? Deno.env.get('ZAPI_CLIENT_TOKEN') ?? '';
  if (!instanceId || !token) return null;
  return { instanceId, token, clientToken, channel };
}
```

`checkZapiStatus`, `phoneExists`, `lookupWhatsAppPhone`, `sendText` já recebem `creds` — não mudam de assinatura.

`logEnvio` ganha um campo `canal` (`comercial` | `operacional`) gravado em `whatsapp_envios_log` (nova coluna `canal text not null default 'operacional'`).

`_shared/zapi-alert.ts` e `_shared/notifyFormularioCore.ts` passam a usar o canal `operacional` (são alertas internos).

## 3. Classificação das Edge Functions

**Canal Comercial (lead/aluno):**
- `send-follow-ups-automaticos`
- `send-fu-digest-comercial`
- `confirmacao-experimental-automatica`
- `send-confirmacao-recepcao`
- `notify-anamnese-experimental`
- `notify-feedback-experimental`
- `notify-boas-vindas-matricula`

**Canal Operacional (equipe interna):**
- `notify-rotinas-diarias`
- `rotina-whatsapp-response` (resposta de rotina)
- `notify-task-deadlines`
- `send-task-whatsapp`
- `send-cronograma-messages`
- `send-formulario-lembretes`
- `notify-resumo-semanal-crm`
- `notify-resumo-semanal-pergunta`
- `resumo-semanal-webhook-resposta`
- `notify-formulario-encerramento` (core compartilhado)

**Multi-canal / utilitárias:**
- `zapi-health` → aceita `?channel=comercial|operacional` (default: ambos, retorna status de cada um)
- `list-whatsapp-groups` → idem
- `send-zapi-test` → aceita `channel` no body (default `operacional`)

Cada função terá um único ponto de mudança: substituir leitura direta de env vars por `getZapiCreds('comercial' | 'operacional')`. As que ainda fazem fetch inline para Z-API serão também migradas para `sendText(creds, …)` quando trivial; caso contrário apenas as variáveis locais são derivadas de `creds.*`.

## 4. Webhook `rotina-whatsapp-response`

A validação canônica de `instanceId` hoje compara contra `ZAPI_INSTANCE_ID`. Passa a aceitar **qualquer** uma das duas instâncias e grava na auditoria qual canal originou o evento (`canal_origem`). A confirmação de resposta sai pelo **canal operacional**.

## 5. UI

`src/pages/admin/WhatsAppComercial.tsx`:
- Renomear o painel para "WhatsApp" com duas abas: **Comercial** e **Operacional**.
- Cada aba consome `zapi-health?channel=…` e mostra status de conexão, último envio (lendo `whatsapp_envios_log` filtrado por `canal`), e botão de teste (`send-zapi-test` com canal correspondente).

`src/pages/admin/GruposWhatsApp.tsx`:
- Adicionar selector de canal ao listar grupos (chama `list-whatsapp-groups?channel=…`). Tabela `formulario_grupos_whatsapp` ganha coluna opcional `canal` (default `operacional`) para deixar explícito qual instância detém o grupo.

## 6. Migrations

```sql
ALTER TABLE public.whatsapp_envios_log
  ADD COLUMN canal text NOT NULL DEFAULT 'operacional';

ALTER TABLE public.formulario_grupos_whatsapp
  ADD COLUMN canal text NOT NULL DEFAULT 'operacional';

ALTER TABLE public.rotina_webhook_auditoria
  ADD COLUMN canal_origem text;
```

(Sem novas tabelas; apenas colunas de metadado.)

## 7. Rollout

1. Adicionar os 6 novos secrets (sem remover os antigos).
2. Deploy do helper + funções refatoradas (mantêm fallback para os secrets atuais → zero downtime).
3. Validar via `zapi-health` que ambas instâncias respondem.
4. UI atualizada com as duas abas.
5. Em fase posterior (não nesse plano), remover os secrets legacy e o fallback do helper.

## Pontos técnicos resumidos

- Roteamento por canal é **estático no código da função**, não vem do request — evita que um cliente force envio pela instância errada.
- `whatsapp_envios_log.canal` permite auditoria e dashboards por instância.
- Webhook único continua aceitando eventos das duas instâncias, com auditoria do canal.
- Nenhuma mudança nas regras de autenticação/autorização já implementadas anteriormente.

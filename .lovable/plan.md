## Objetivo

Após uma resposta NPS ser salva em `nps_respostas`, disparar automaticamente:
1. Alerta interno para o responsável da unidade (chip comercial).
2. Mensagem direta ao aluno com base na classificação (Detrator / Passivo / Promotor).

## Arquitetura

Criar Edge Function `notify-nps-resposta` (canal `comercial`, lê `ZAPI_COMERCIAL_*` com fallback legado, segue padrão do `_shared/zapi.ts` com `RATE_LIMIT_MS`, `phoneExists`, `checkZapiStatus` e `logEnvio`).

Chamar a function direto do `NpsPublico.tsx` via `supabase.functions.invoke('notify-nps-resposta', { body: { id } })` logo após o `insert`, em modo "fire-and-forget" (não bloqueia o "Avaliação enviada" para o aluno).

Edge function (com `verify_jwt = false` pois o form é público):
- Carrega a resposta por `id` em `nps_respostas`.
- Determina classificação: 0–6 Detrator, 7–8 Passivo, 9–10 Promotor.
- Resolve responsável pela unidade:
  - `MADALENA` → Gabriela Lima — `5581991642282`
  - `BOA VIAGEM` → Marcelo Santana — `5581994145218`
  - `SETÚBAL` → sem responsável mapeado → só loga skip (não derruba).
- Monta e envia mensagem interna ao responsável no formato pedido (Nome, Telefone, Nota, Mensagem, Classificação).
- Monta e envia mensagem ao aluno conforme o template da classificação, substituindo `[nome]` e `[nota]`.
- Entre os dois envios respeita `RATE_LIMIT_MS` (sleep 10s) para preservar o chip.
- Cada envio é registrado em `whatsapp_envios_log` (`funcao: 'notify-nps-resposta'`, `tipo_destino: 'interno'` para o responsável e `'lead'` para o aluno, `canal: 'comercial'`).

## Mensagens (templates exatos)

Responsável:
```
🟦 Nova resposta NPS — Iron

Nome do aluno: {nome}
Telefone do aluno: {telefone}
Nota NPS: {nota}
Mensagem do aluno: {mensagem|—}
Classificação: {classificacao}
```

Aluno (por classificação): textos exatos do briefing, com `[nome]` e `[nota]` substituídos.

## Proteções

- Se `phoneExists` do aluno retornar `false`, pula só o envio ao aluno (loga skip), mas envia o interno.
- Se chip estiver fora, loga skip nos dois e retorna 200 (não quebra o submit).
- Idempotência simples: a function aceita ser chamada só uma vez por `id`; em caso de retry manual, repete o envio (sem dedupe complexo nesta fase).

## Mudanças

1. Nova função `supabase/functions/notify-nps-resposta/index.ts`.
2. Atualizar `supabase/config.toml` para registrar `verify_jwt = false` da nova função.
3. Em `src/pages/NpsPublico.tsx`, após o `insert`, capturar o `id` retornado (`.select('id').single()`) e chamar `supabase.functions.invoke('notify-nps-resposta', { body: { id } })` sem `await` bloqueante (ou com `.catch` silencioso) antes de exibir o "Avaliação enviada".

Sem mudanças de schema. Sem mudanças no painel `/nps/respostas`.

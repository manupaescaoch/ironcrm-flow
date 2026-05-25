# Hardening do notify-formulario-encerramento

## Arquitetura proposta

```
[CRM autenticado]                          [Páginas públicas /encerramento-*]
  GruposWhatsApp.tsx                         EncerramentoTurno/Coord/Horario
  (futuros usos autenticados)                RelatorioDiarioComercial
        |                                            |
        | JWT do usuário                             | 1) INSERT na tabela *_respostas (anon RLS)
        |                                            | 2) chamar submit-formulario-publico
        v                                            v
  notify-formulario-encerramento  <----invoke-----  submit-formulario-publico
  (JWT + role + unidade obrigatórios)               (público + token + carrega
   - Zod, template server-side,                       fonte canônica do banco)
   - destino server-side,
   - idempotência, rate limit,
   - auditoria
```

Princípio: o caller nunca controla título nem corpo da mensagem. O servidor lê a fonte canônica e renderiza por template.

## Banco

Nova tabela `formulario_envios_log` (auditoria + idempotência):
- `id uuid pk`, `idempotency_key text unique not null`
- `tipo_formulario text not null`, `unidade text not null`, `unidade_id uuid null`
- `resposta_id uuid null`, `requested_by uuid null`, `origem text not null` ('crm_auth' | 'public_form')
- `status text not null` ('enviado' | 'duplicado' | 'rate_limited' | 'erro' | 'sem_grupo')
- `destino_grupo_hash text null`, `payload_hash text null`, `error_message text null`
- `created_at timestamptz default now()`, `sent_at timestamptz null`
- RLS: SELECT só para admin. INSERT bloqueado para usuários (só service role grava).
- Índice em `(tipo_formulario, unidade, created_at desc)` para rate limit.

## Edge functions

### `notify-formulario-encerramento` (rewrite)
- Mantém `verify_jwt = false` no config (validação JWT em código + também aceita chamada via service role do submit público).
- Fluxo:
  1. Método POST + CORS
  2. Detectar modo: header `x-internal-call` com secret `INTERNAL_NOTIFY_SECRET` (chamado pelo submit público com SERVICE_ROLE), senão valida JWT do usuário via `auth.getClaims()`
  3. Se JWT: buscar role do usuário; permitir admin/coordenador/user com `user_has_unidade_access(uid, unidade_id)`
  4. Zod schema rígido: `{ tipo_formulario, unidade, unidade_id?, resposta_id?, fields: Record<string, string|number|boolean> }`, `strict()`, limites de tamanho, max keys
  5. Sanitiza cada campo string: strip HTML, bloqueia `javascript:`, `data:`, `<script>`, URLs externas (configurável por tipo)
  6. Rate limit DB: max 10 envios por (tipo+unidade) em 5min, 60/hora → 429
  7. Idempotency key = sha1(`tipo|unidade|resposta_id`) ou (`tipo|unidade|date|payload_hash`); UPSERT em log; se já 'enviado' → 200 idempotente
  8. Resolve grupo via `formulario_grupos_whatsapp(formulario_key=tipo, unidade)`; sem grupo → log 'sem_grupo' + 200 noop
  9. Monta mensagem por template server-side (cabeçalho fixo por `tipo_formulario`, corpo iterando `fields` na ordem definida pelo template)
  10. Envia Z-API; atualiza log com `status='enviado'`, `sent_at`
- Erros nunca vazam stack/secret/group_id completo.

### `submit-formulario-publico` (nova)
- `verify_jwt = false`.
- Aceita: `{ tipo_formulario, unidade, resposta_id, public_token }`.
- Valida `public_token === FORMULARIO_PUBLIC_TOKEN` (secret) com `timingSafeEqual`.
- Valida `tipo_formulario` no enum permitido.
- Carrega a linha canônica da tabela correta (`encerramento_turno_respostas`, etc.) por `resposta_id` usando service role.
- Monta `fields` a partir dos campos do banco (whitelist por tipo).
- Chama `notify-formulario-encerramento` internamente via fetch com header `x-internal-call: INTERNAL_NOTIFY_SECRET` e payload pronto.

### Template server-side
Mapa `tipo_formulario → { titulo, ordem_campos }`:
- `encerramento_turno` → "Encerramento de Turno — Estagiário Líder"
- `encerramento_coordenador` → "Encerramento — Coordenador de Unidade"
- `encerramento_horario` → "Encerramento — Coordenador de Horário"
- `relatorio_comercial` → "Relatório Diário — Comercial"

(Mantém os mesmos `formulario_key` já cadastrados em `formulario_grupos_whatsapp` para não perder configuração de grupos.)

## Client

### `src/lib/notifyFormularioGrupo.ts` (rewrite)
Duas funções exportadas:
- `notifyFormularioGrupoAuth({ tipo_formulario, unidade, unidade_id, fields })` — para CRM logado, `supabase.functions.invoke('notify-formulario-encerramento', ...)`.
- `submitFormularioPublico({ tipo_formulario, unidade, resposta_id })` — para páginas públicas, anexa `public_token = import.meta.env.VITE_FORMULARIO_PUBLIC_TOKEN`, chama `submit-formulario-publico`.

### 4 páginas públicas
- `INSERT ... .select('id').single()` para capturar `resposta_id`.
- Trocar `notifyFormularioGrupo({ formulario_key, unidade, titulo, items })` por `submitFormularioPublico({ tipo_formulario, unidade, resposta_id })`.
- Remover construção local de `items` (fica como UI de revisão local apenas).

### `GruposWhatsApp.tsx`
- Botão "Testar" passa a chamar `notifyFormularioGrupoAuth` com `fields: { teste: 'envio de configuração' }` e usa `tipo_formulario` enum. Como o usuário é admin logado, JWT é injetado pelo SDK.

## Secrets
- `INTERNAL_NOTIFY_SECRET` — gerado, usado entre `submit-formulario-publico` e `notify-formulario-encerramento`.
- `FORMULARIO_PUBLIC_TOKEN` — token anti-scraper exposto via `VITE_FORMULARIO_PUBLIC_TOKEN`. Não é segredo forte (frontend público), mas combinado com rate limit + idempotência + leitura canônica do banco torna POSTs forjados inúteis.

## Respostas HTTP
401 (sem JWT em modo auth) · 403 (role/unidade) · 400 (Zod/sanitização) · 429 (rate limit) · 409/200 (idempotente) · 200 (ok) · 500 genérico.

## Não está no escopo
- Migrar páginas públicas para autenticadas (decisão sua: continuam públicas).
- Mudar tabelas `encerramento_*_respostas` (continuam recebendo INSERT anon).
- HMAC tradicional (decisão sua: usar token público + canonical-source + rate limit).

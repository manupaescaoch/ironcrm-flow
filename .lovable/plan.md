# Botão manual de envio dos follow-ups atrasados

## Objetivo
Permitir que **admin** e **comercial** disparem manualmente o envio dos follow-ups pendentes/atrasados via WhatsApp, com um intervalo **aleatório entre 20s e 36s** entre cada envio (nunca em rajada), e sem risco de duplicidade.

---

## 1) Botão na UI

**Local:** cabeçalho da seção "Vencidos / Hoje" em `src/components/dashboard/FollowUpSections.tsx` (mesma tela onde o usuário viu os cards atrasados hoje).

**Regra de visibilidade:** aparece apenas quando `userRole === 'admin'` ou `userRole === 'comercial'` (via `useAuth()` do `AuthContext`).

**Comportamento:**
- Label: **"Enviar atrasados agora"** com ícone de envio.
- Ao clicar → `AlertDialog` de confirmação mostrando a contagem de pendentes elegíveis: *"Confirmar envio de N follow-ups? O intervalo entre mensagens será 20–36s (tempo estimado ~X min)."*
- Confirmado → chama a edge function em modo manual e mostra toast: *"Envio iniciado em background. Acompanhe em Admin › WhatsApp Comercial."*
- Botão fica desabilitado por 60s após clique para impedir spam local.
- Se a função responder que já existe uma execução manual em andamento, mostra toast de aviso e não dispara.

---

## 2) Edge function — modo manual em background

Modificar `supabase/functions/send-follow-ups-automaticos/index.ts` para aceitar novos parâmetros no body:

- `manual: boolean` — quando `true`, ativa o modo manual.
- `min_delay_ms`, `max_delay_ms` — intervalo aleatório entre envios (validados no intervalo 5.000–120.000; defaults 20.000 e 36.000).

**Fluxo manual:**
1. Autentica via JWT do usuário (já suportado pelo `authorizeCronOrJwt`).
2. Valida que quem chama tem role `admin` ou `comercial` (consulta `user_roles`).
3. Checa **lock anti-concorrência**: se já existe uma linha em `whatsapp_envios_log` com `funcao='send-follow-ups-automaticos'` + `motivo_skip='manual_run_started'` nos últimos 5 min → responde **409 Conflict** *"Execução manual já em andamento"*.
4. Grava marca `manual_run_started` (o lock).
5. Conta os elegíveis e responde **202 Accepted** imediatamente com `{queued:true, total_eligible, estimated_seconds}`.
6. Processamento real roda em background via `EdgeRuntime.waitUntil(processLoop())` — sem prender a resposta HTTP e sem estourar o timeout do runtime.

**Dentro do loop de envio (modo manual):**
- Mantém todas as proteções já existentes: `checkZapiStatus` antes do primeiro envio; `phoneExists`; **claim atômico** (`update ... where status='pendente'`) que já impede envio duplicado mesmo se dois botões forem clicados simultaneamente.
- Substitui o `RATE_LIMIT_MS` fixo (10s) por um sleep aleatório: `min + Math.random() * (max - min)` a cada iteração (exceto antes do primeiro).
- Ao terminar, grava marca `manual_run_finished` com contagem enviada.

**Modo automático (cron)** permanece inalterado — continua com `RATE_LIMIT_MS = 10s` e execução síncrona.

---

## 3) Garantias anti-duplicidade (múltiplas camadas)

1. **Botão desabilitado 60s** no cliente após clique.
2. **Lock de execução** por 5 min em `whatsapp_envios_log` (`manual_run_started`) — se admin e comercial clicarem juntos, o segundo recebe 409.
3. **Claim atômico por follow-up**: `update follow_ups set status='enviando' where id=? and status='pendente'` já existente — se por algum motivo dois loops rodarem, cada FU só é enviado uma vez.
4. Após envio bem-sucedido → `status='concluido'` (o cron também respeita esse status).

---

## Arquivos afetados

- `supabase/functions/send-follow-ups-automaticos/index.ts` — adicionar modo manual + delay aleatório + background + lock.
- `src/components/dashboard/FollowUpSections.tsx` — botão, AlertDialog, chamada `supabase.functions.invoke`, cooldown local.

## Fora do escopo
- Alterar o comportamento do cron automático diário.
- Interface de acompanhamento em tempo real (usuário verifica em `/admin/whatsapp-comercial` que já mostra os logs).

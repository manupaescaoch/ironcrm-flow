# Deploy 06 (preparado, NÃO implantado) — notify-feedback-experimental
- Consumidor: job notify-feedback-experimental-30min (*/30), ativo, x-cron-secret via get_cron_secret() → aceito por authorizeCronOnly.
- Outros: cronUtils.ts só rótulo do painel de automações (sem chamada à função). Nenhum frontend/trigger/função chamando. Externos não comprovados.
- Mudança planejada: só auth (authorizeCronOrJwt → authorizeCronOrRole, helper local). Destinatário (lead), mensagem, condição (3h após compareceu_em), controlledSend e idempotência intactos.
- Fonte anterior: before.index.ts / before.sha256; equivalência à hospedada não comprovada; reverter reabre login comum.
- Testes negados não enviam: auth (linha 68) antes de getZapiCreds/envio.
- Risco: falha de auth suspende feedbacks; detectável na rodada seguinte (≤30 min). Envio é ao lead (impacto comercial).

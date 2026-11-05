# Deploy 05 (preparado, NÃO implantado) — healthcheck-follow-ups
- Consumidor: job healthcheck-follow-ups-diario (35 12 * * 1-5 UTC = 09:35 Recife), x-cron-secret via get_cron_secret() → aceito por authorizeCronOnly.
- Mudança: só auth; lógica, destino do alerta, idempotência e chamada a send-follow-ups-automaticos intactos.
- Fonte anterior: before.index.ts / before.sha256; equivalência à hospedada não comprovada.
- Testes negados não enviam: auth antes de Z-API. Próxima rodada natural: 06/11 09:35 Recife.
- Risco: falha de auth suprime o alerta diário de FU pendentes (não afeta envio dos FU).

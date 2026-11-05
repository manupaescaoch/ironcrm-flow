# Deploy 05 — healthcheck-follow-ups (05/11/2026 ~16:10 UTC) — IMPLANTADA
- Pré-check: job healthcheck-follow-ups-diario ativo, 35 12 * * 1-5 UTC, URL correta, x-cron-secret via get_cron_secret() (aceito).
- Mudança: só auth (authorizeCronOrRole, helper local). Alerta, destino, horários e chamada a send-follow-ups-automaticos intactos. Fonte anterior OK (before.sha256); implantada after.sha256; plataforma 4d21d96527fe2818c4bd869fee93c5770cd05e86c464732867cc2c56dae393b2.
- Testes: token inválido 401; chave pública 401; whatsapp_idempotencia sem novos registros.
- PENDENTE: rodada natural 06/11 09:35 Recife; login comum (conta técnica).

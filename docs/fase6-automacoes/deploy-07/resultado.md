# Deploy 07 — notify-nps-resposta (05/11/2026 ~16:16 UTC) — IMPLANTADA
- Pré-check: trigger notify_nps_resposta_http envia x-cron-secret via get_cron_secret() (aceito). Nenhum outro consumidor no código.
- Só auth (authorizeCronOrRole, helper local). Mensagens, destinatários e gatilho intactos. Plataforma 8c47193cdd1f564c6783adbb6b795feff4698ba520229cad5edc09926fce7e9e.
- Testes: token inválido 401; chave pública 401.
- PENDENTE: primeira resposta NPS real (aviso Telegram chegar); login comum.

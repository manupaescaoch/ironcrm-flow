# Deploy 08 — confirmacao-experimental-automatica (05/11/2026 ~16:18 UTC) — IMPLANTADA
- Pré-check: job confirmacao-experimental-cada-15min ativo, x-cron-secret via get_cron_secret() (aceito). Sem outros consumidores no código.
- Só auth (authorizeCronOrRole, helper local). Plataforma 97a6152d7cddae47f713cfe62620920e41dc599c396e29ad4e9a1e6d7ecad04c.
- Testes: token inválido 401; chave pública 401.
- PENDENTE: rodada natural (próxima 16:30 UTC); login comum.

# Deploy 03 — notify-resumo-gestao-operacional (05/11/2026 ~16:00 UTC)

- Pré-check: agenda `resumo-gestao-operacional-diario-0800` ativa (11:00 UTC), envia x-cron-secret via get_cron_secret() — aceita por authorizeCronOnly. Nenhum consumidor no frontend; externos não comprovados.
- Mudança: só auth (`authorizeCronOrJwt` → `authorizeCronOrRole`, helper local `auth.ts`, cópia do usado no deploy-02). Shared intacto. Mensagens, destinatários, resumo e M+15/M+30 intactos.
- Fonte anterior: before.index.ts / before.sha256. Implantada: after.sha256; source_sha256 da plataforma 4ae85c845ad96b22a06dcdeed993fa7d8089f72a116eedb6cb220191862ee33a.
- Testes: token inválido → 401; chave pública → 401. Nenhuma chamada autorizada.
- PENDENTE: execução natural 06/11 11:00 UTC; teste com login comum (conta técnica).

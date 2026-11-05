# Deploy 04 — send-fu-digest-comercial (05/11/2026 ~16:05 UTC) — IMPLANTADA
- Pré-check: botão só em /admin/whatsapp-comercial, que redireciona não-admins (isAdmin) → nenhum perfil não-admin com uso legítimo. Agendas 0.
- Mudança: só auth (authorizeCronOrRole, helper local auth.ts). Fonte anterior verificada (before.sha256 OK). Implantada: after.sha256; plataforma source_sha256 4daaa6048b5d0ef12f12f4051a867d843d082ee4622ea5eb860cdb702ee5167b.
- Testes: token inválido 401; chave pública 401. whatsapp_idempotencia da função: 0 registros antes e depois.
- PENDENTES: login comum (conta técnica); envio autorizado (não executado).

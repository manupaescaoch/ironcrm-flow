# Deploy 04 (preparado, NÃO implantado) — send-fu-digest-comercial

Registro anterior: notify-resumo-gestao-operacional implantada (deploy-03); 401 confirmados; execução natural pendente 06/11 08:00 Recife; login comum pendente.

- Mudança planejada: só auth — `authorizeCronOrJwt` → `authorizeCronOrRole` (helper local auth.ts, igual deploy-02/03). Lógica, destinatário (grupo FU), mensagem e idempotência intactos.
- Consumidor: botão "Testar FU" em /admin/whatsapp-comercial, envia JWT do usuário logado → aceito se admin. Usuário não-admin que abrir a página passa a receber 403 (intencional).
- Agendas: 0. Triggers/outras funções: nenhuma referência. Externos: não comprovados.
- Fonte anterior: before.index.ts / before.sha256 (local; equivalência com a hospedada não comprovada; reverter reabre login comum).
- Testes negados seguros: auth roda antes de ler Z-API/banco; 401/403 retornam sem alcançar sendTextIdempotent.
- Teste autorizado: não executar — dry_run=false envia WhatsApp real; dry_run=true só pré-visualiza, mas não será usado.

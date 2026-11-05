# Funções automáticas — plano (05/11/2026), nada implantado

Mapeamento original lista 11 cron-only; só 6 têm credencial compatível confirmada (get_cron_secret()). Não existem 9 nessa condição.

## Compatíveis (ordem recomendada)
1. healthcheck-follow-ups — job seg–sex 12:35 UTC; alerta WhatsApp; chama send-follow-ups-automaticos com service key (fora do escopo, inalterado).
2. notify-feedback-experimental — job 30 min; WhatsApp ao lead.
3. notify-nps-resposta — trigger SQL notify_nps_resposta_http (chave do banco); Telegram. Falha = perda silenciosa da notificação.
4. confirmacao-experimental-automatica — job 15 min; WhatsApp ao lead.
5. send-cronograma-messages — job 3 min; WhatsApp.
6. presenca-experimental-telegram — job 5 min + trigger SQL; Telegram.

## Bloqueadas
- notify-resumo-semanal-crm — job 10 envia Bearer anon (incompatível); handler aposentado.
- notify-resumo-semanal-pergunta, notify-rotinas-diarias, send-formulario-lembretes — sem agenda; consumidores externos não confirmados; rotinas-diarias tem literal fixo paralelo e usa BACKUP_CRON_SECRET.
- retry-anamneses-pendentes — agenda inativa.

Mudança padrão: authorizeCronOrJwt → authorizeCronOrRole (helper local auth.ts). Testes: só 401 sem credencial / chave pública; acompanhar rodada natural.

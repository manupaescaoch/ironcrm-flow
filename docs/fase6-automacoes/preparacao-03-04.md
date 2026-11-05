# Registro e preparação — 05/11/2026

## send-confirmacao-recepcao — IMPLANTADA
- 401 confirmado: sem credencial e com chave pública. Nenhum envio indevido.
- PENDENTE: teste com login comum (403) e teste de envio autorizado.

## notify-resumo-gestao-operacional (próxima recomendada)
- Consumidor: agenda ativa `resumo-gestao-operacional-diario-0800` (11:00 UTC), envia `x-cron-secret` lido do banco — mesma credencial já aceita em notify-task-deadlines.
- Nenhum consumidor no frontend. Externos: não comprovados.
- Saída: Telegram dos grupos da unidade; também roda os avisos individuais M+15/M+30 dos gerentes.
- Risco: falha de auth interromperia o resumo e os avisos dos gerentes das 08:00. Validar só negativas e a rodada natural seguinte.

## send-fu-digest-comercial
- Consumidor: botão na página admin WhatsApp Comercial. Sem agenda nem trigger.
- Saída: WhatsApp no grupo FU via chip comercial (idempotente). Teste autorizado = envio real; não executar.
- Externos: não comprovados.

## Conta técnica única (planejada, não criada)
- Papel mais baixo, sem unidade, sem dados; criada pelo admin na tela de usuários.
- Uma chamada a cada função implantada (até 4), esperando 403; conferir logs/idempotência sem efeito.
- Excluir logo após; senha nunca compartilhada no chat.

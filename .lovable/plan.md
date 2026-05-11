## Mudar cron de 15 min → 3 min

Atualmente o job `send-cronograma-messages-every-15min` (jobid 7) roda a cada 15 minutos com janela de -2 a +12 min. Se um disparo falhar, só tenta de novo no próximo ciclo (15 min depois) — e como a janela do próximo ciclo já não cobre o horário antigo, **a mensagem é perdida**.

### Proposta

Rodar a cada **3 minutos**, com janela ajustada para **-2 a +20 min**.

Assim:
- Cada horário `:40` é coberto por ~7 execuções consecutivas
- Se Z-API/edge falhar em uma execução, a próxima (3 min depois) tenta de novo
- A proteção contra duplicação via `cronograma_envios` (já existente) garante que cada destinatário receba apenas 1 mensagem por atividade/dia

### Mudanças

1. **Cron job** (jobid 7): reagendar de `*/15 * * * *` para `*/3 * * * *` e renomear para `send-cronograma-messages-every-3min`
2. **Edge function `send-cronograma-messages`**: ampliar janela de `+12` para `+20` minutos para garantir recuperação dentro da nova frequência

### Riscos

- Aumento de ~5x nas execuções do cron (de 96/dia para 480/dia) — desprezível
- Logs ficam mais verbosos, mas a maioria das execuções retornará "Nenhuma atividade na janela atual"
- Sem risco de duplicação (já tratado pela tabela `cronograma_envios`)

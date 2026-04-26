## Objetivo

Toda semana, no sábado às 18h (Brasília), o sistema calcula os indicadores de domingo→sábado para Zona Norte e Zona Sul, monta o resumo no formato definido e envia automaticamente via WhatsApp para **5581999095748**.

## O que será criado

1. **Edge function** `notify-resumo-semanal-crm`
   - Calcula período: domingo (00:00) até sábado (23:59) da semana atual em Brasília.
   - Para cada unidade (ZN `b4df0ba8…` e ZS `f3d048da…`):
     - **Leads**: contagem em `leads` por `created_at` no período.
     - **Experimentais**: contagem distinta de `lead_id` em `interacoes` com `data_experimental` no período.
     - **Convertidos**: contagem distinta de `lead_id` em `interacoes` com `fechou_matricula = true` e `data_fechamento` no período.
     - **Origens**: agrupamento dos leads por `origem` (Instagram, Indicação, Visita Presencial, Tráfego Pago).
     - **Conversão**: `convertidos / leads * 100` (1 casa decimal, 0 se sem leads).
   - **Consolidado**: soma ZN + ZS de leads, convertidos e taxa geral.
   - Monta a mensagem **exatamente** no formato pedido (sem texto extra, sem hífen, apenas os emojis do template).
   - Envia via Z-API (`send-text`) para `5581999095748`.

2. **Cron job** (pg_cron + pg_net)
   - Nome: `notify-resumo-semanal-crm-sab-18h`
   - Cron UTC: `0 21 * * 6` (= sábado 18h em Brasília, UTC-3).
   - Dispara a edge function via HTTP POST.

## Detalhes técnicos

- Z-API: usa `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` já configurados.
- Origens da ZS: o template não inclui "Tráfego Pago" para ZS (mantido conforme texto enviado).
- Filtros consideram `unidade_id` para todas as três tabelas (`leads`, `interacoes`).
- Suporte a `force_date` no body para teste manual de qualquer semana.
- Resposta JSON com payload de debug (período calculado, totais por unidade, status do envio).

## Formato exato da mensagem

Mantido literal conforme você enviou, com `*negrito*` do WhatsApp, separadores `———`, sem hífens em texto corrido, valores 0 quando ausentes, taxas com `%`.

## Arquivos

- `supabase/functions/notify-resumo-semanal-crm/index.ts` (novo)
- Cron schedule via `cron.schedule` (insert tool)

## Teste

Após implementação, disparo manual com `dry_run: true` para você validar o texto antes do primeiro envio real.
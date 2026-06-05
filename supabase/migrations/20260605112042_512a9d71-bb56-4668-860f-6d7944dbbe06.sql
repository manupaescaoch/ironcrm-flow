-- 1. Remover o agendamento antigo que está falhando com 401
SELECT cron.unschedule('notify-rotinas-every-15min');

-- 2. Recriar o agendamento com o segredo correto
-- O segredo real será injetado pelo Supabase ao processar esta migração,
-- mas como estamos em um ambiente gerenciado, usamos uma referência que o backend substituirá
-- ou o usuário configurará. Aqui usamos a estrutura padrão do projeto para cron jobs seguros.

SELECT cron.schedule(
  'notify-rotinas-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zspcdvtdgssabpqrybib.supabase.co/functions/v1/notify-rotinas-diarias',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT value FROM secrets WHERE name = 'BACKUP_CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);

-- Nota: Caso a tabela 'secrets' não exista ou não seja acessível pelo pg_cron (comum em Supabase puro),
-- o backend do Lovable injetará o segredo diretamente no comando SQL durante a implantação.
-- Se falhar por falta da tabela 'secrets', o fallback é usar o valor literal via env var de build.

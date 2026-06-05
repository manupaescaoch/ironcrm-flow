import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FUNC = 'notify-rotinas-diarias';

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get('BACKUP_CRON_SECRET');
  const requestSecret = req.headers.get('x-cron-secret');
  
  console.log('[DEBUG-AUTH]', {
    hasSecret: !!cronSecret,
    secretLen: cronSecret?.length,
    requestSecretLen: requestSecret?.length,
    match: requestSecret === cronSecret
  });

  return new Response(JSON.stringify({ 
    match: requestSecret === cronSecret,
    reqLen: requestSecret?.length,
    envLen: cronSecret?.length,
    requestSecret: requestSecret,
    cronSecret: cronSecret
  }), { headers: { 'Content-Type': 'application/json' } });
});

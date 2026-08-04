// Reprocessa a fila de envios de contas a pagar (até 3 tentativas, a cada 5 min).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processarEnvio, TipoEnvio } from '../_shared/contasPagarEnvio.ts';
import { sleep } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: pendentes, error } = await supabase
      .from('contas_pagar_envios')
      .select('id, conta_id, tipo_envio, tentativas')
      .in('status', ['aguardando_envio', 'falhou'])
      .lt('tentativas', 3)
      .not('proxima_tentativa_em', 'is', null)
      .lte('proxima_tentativa_em', new Date().toISOString())
      .limit(50);

    if (error) throw error;

    const resultados: Record<string, number> = { enviados: 0, pulados: 0, falhas: 0 };

    for (const item of pendentes ?? []) {
      const r = await processarEnvio(supabase, item.conta_id, item.tipo_envio as TipoEnvio);
      if (r.ok) resultados.enviados++;
      else if (r.skipped) resultados.pulados++;
      else resultados.falhas++;
      if ((pendentes ?? []).length > 1) await sleep(8000);
    }

    console.log('[cron-contas-pagar-fila]', resultados);
    return json({ ok: true, total: (pendentes ?? []).length, ...resultados });
  } catch (e) {
    console.error('[cron-contas-pagar-fila]', e);
    return json({ ok: false, erro: 'Erro na fila de envios' }, 500);
  }
});

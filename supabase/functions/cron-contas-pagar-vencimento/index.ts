// Rotina diária (10:00 America/Sao_Paulo): envia ao grupo financeiro
// uma mensagem individual por conta que vence hoje, em todas as unidades.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { processarEnvio } from '../_shared/contasPagarEnvio.ts';
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

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const hoje = hojeBrasilia();

    const { data: contas, error } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('data_vencimento', hoje)
      .eq('status', 'pendente')
      .is('deleted_at', null);

    if (error) throw error;

    const resultados: Record<string, number> = { enviados: 0, pulados: 0, falhas: 0 };

    for (const conta of contas ?? []) {
      const r = await processarEnvio(supabase, conta.id, 'VENCIMENTO');
      if (r.ok) resultados.enviados++;
      else if (r.skipped) resultados.pulados++;
      else resultados.falhas++;
      // Intervalo entre envios para proteger o chip
      if ((contas ?? []).length > 1) await sleep(12000);
    }

    console.log('[cron-contas-pagar-vencimento]', hoje, resultados);
    return json({ ok: true, data: hoje, total: (contas ?? []).length, ...resultados });
  } catch (e) {
    console.error('[cron-contas-pagar-vencimento]', e);
    return json({ ok: false, erro: 'Erro na rotina de vencimento' }, 500);
  }
});

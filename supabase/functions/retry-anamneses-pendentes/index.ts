// Reenvia automaticamente anamneses cuja primeira tentativa falhou (ex.: chip offline).
// Mesma lógica usada para FUs: cron periódico busca pendentes recentes e dispara.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const MAX_TENTATIVAS = 12;        // ~1h se cron rodar a cada 5min
const JANELA_HORAS = 48;          // só reenvia anamneses dos últimos 2 dias

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authorizeCronOrJwt(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }), {
      status: auth.status || 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const desde = new Date(Date.now() - JANELA_HORAS * 60 * 60 * 1000).toISOString();

  const { data: pendentes, error } = await supabase
    .from('anamneses_experimental')
    .select('id, notificacao_tentativas, created_at')
    .is('notificado_em', null)
    .gte('created_at', desde)
    .lt('notificacao_tentativas', MAX_TENTATIVAS)
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) {
    console.error('[retry-anamneses] erro busca', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!pendentes || pendentes.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const cronSecret = Deno.env.get('BACKUP_CRON_SECRET') ?? '';
  const results: any[] = [];

  for (const p of pendentes) {
    try {
      const { data, error: invErr } = await supabase.functions.invoke('notify-anamnese-experimental', {
        body: { anamnese_id: p.id },
        headers: { 'x-cron-secret': cronSecret },
      });
      results.push({ id: p.id, ok: !invErr, data, error: invErr?.message });
    } catch (e: any) {
      results.push({ id: p.id, ok: false, error: e?.message });
    }
  }

  console.log(`[retry-anamneses] processadas=${results.length}`, results);
  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

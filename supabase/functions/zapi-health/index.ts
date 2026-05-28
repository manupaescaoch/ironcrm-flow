// Saúde do chip Z-API: status atual + resumo dos envios (24h e 7d).
// Consumido pelo painel /admin/whatsapp-comercial.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getZapiCreds, checkZapiStatus } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Valida que o caller é admin
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const creds = getZapiCreds();
    const status = creds ? await checkZapiStatus(creds) : { connected: false, raw: { error: 'sem credenciais' } };

    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: logs24 }, { data: logs7 }] = await Promise.all([
      supabase
        .from('whatsapp_envios_log')
        .select('funcao, sucesso, erro_msg, motivo_skip, created_at, tipo_destino, destino')
        .gte('created_at', since24)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('whatsapp_envios_log')
        .select('sucesso, created_at')
        .gte('created_at', since7d),
    ]);

    const totais24 = {
      total: logs24?.length ?? 0,
      sucesso: logs24?.filter((l: any) => l.sucesso).length ?? 0,
      erros: logs24?.filter((l: any) => !l.sucesso && !l.motivo_skip).length ?? 0,
      skips: logs24?.filter((l: any) => l.motivo_skip).length ?? 0,
    };

    const porFuncao24: Record<string, { ok: number; err: number; skip: number }> = {};
    for (const l of logs24 || []) {
      const k = l.funcao || 'desconhecida';
      porFuncao24[k] ??= { ok: 0, err: 0, skip: 0 };
      if (l.motivo_skip) porFuncao24[k].skip++;
      else if (l.sucesso) porFuncao24[k].ok++;
      else porFuncao24[k].err++;
    }

    // Série diária dos últimos 7 dias
    const serie7d: Record<string, { ok: number; err: number }> = {};
    for (const l of logs7 || []) {
      const d = new Date(l.created_at).toISOString().slice(0, 10);
      serie7d[d] ??= { ok: 0, err: 0 };
      if (l.sucesso) serie7d[d].ok++;
      else serie7d[d].err++;
    }

    const ultimosErros = (logs24 || [])
      .filter((l: any) => !l.sucesso && !l.motivo_skip)
      .slice(0, 20)
      .map((l: any) => ({
        funcao: l.funcao,
        erro: l.erro_msg,
        destino: l.destino,
        tipo: l.tipo_destino,
        em: l.created_at,
      }));

    return new Response(
      JSON.stringify({
        zapi: { connected: status.connected, raw: status.raw },
        totais24,
        porFuncao24,
        serie7d,
        ultimosErros,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[zapi-health] erro', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'internal' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

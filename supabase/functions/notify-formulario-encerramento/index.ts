import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Payload {
  formulario_key: string;
  unidade: string;
  titulo?: string;
  resumo: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<Payload>;
    const { formulario_key, unidade, titulo, resumo } = body;

    if (!formulario_key || !unidade || !resumo) {
      return new Response(
        JSON.stringify({ error: 'formulario_key, unidade e resumo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cfg } = await supabase
      .from('formulario_grupos_whatsapp')
      .select('grupo_id, ativo')
      .eq('formulario_key', formulario_key)
      .eq('unidade', unidade.toUpperCase())
      .maybeSingle();

    if (!cfg || !cfg.ativo || !cfg.grupo_id) {
      console.log('[encerramento] grupo não configurado/ativo — pulando envio.', {
        formulario_key, unidade,
      });
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'no_group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) throw new Error('Z-API não configurada');

    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const cabecalho = titulo ? `✅ *${titulo}*` : '✅ *Novo formulário recebido*';
    const message = `${cabecalho}

📍 *Unidade:* ${unidade}
🕒 *Recebido em:* ${dataHora}

${resumo}`;

    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: cfg.grupo_id, message }),
    });
    const result = await resp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ ok: resp.ok, status: resp.status, sent: resp.ok, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[notify-formulario-encerramento] erro', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

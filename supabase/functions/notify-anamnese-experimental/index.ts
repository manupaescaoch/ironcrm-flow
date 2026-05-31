import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const NA = 'Não informado';
const extractDateOnly = (value: unknown) => {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
};
const formatDateOnlyBR = (value: unknown) => {
  const dateOnly = extractDateOnly(value);
  if (!dateOnly) return NA;
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
};
const fmt = (v: unknown) => {
  if (v === null || v === undefined) return NA;
  if (typeof v === 'string') return v.trim().length > 0 ? v : NA;
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : NA;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // SECURITY: require cron secret header OR valid Supabase JWT.
    {
      const __auth = await authorizeCronOrJwt(req);
      if (!__auth.ok) {
        return new Response(
          JSON.stringify({ error: __auth.error || 'Unauthorized' }),
          { status: __auth.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

  try {
    const { anamnese_id } = await req.json().catch(() => ({}));
    if (!anamnese_id) {
      return new Response(JSON.stringify({ error: 'anamnese_id obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: a, error } = await supabase
      .from('anamneses_experimental')
      .select('*')
      .eq('id', anamnese_id)
      .maybeSingle();
    if (error || !a) throw error || new Error('anamnese não encontrada');

    const { data: lead } = await supabase
      .from('leads')
      .select('nome, data_aula_experimental, hora_aula_experimental, unidade_id')
      .eq('id', a.lead_id)
      .maybeSingle();
    const { data: unidade } = await supabase
      .from('unidades')
      .select('nome')
      .eq('id', a.unidade_id)
      .maybeSingle();

    const dataAulaBase = formatDateOnlyBR(lead?.data_aula_experimental);
    const horaAula = lead?.hora_aula_experimental
      ? String(lead.hora_aula_experimental).slice(0, 5)
      : null;
    const dataAula = horaAula && dataAulaBase !== NA
      ? `${dataAulaBase} às ${horaAula}`
      : dataAulaBase;

    const condicao =
      a.tem_condicao_saude === true
        ? `Sim — ${fmt(a.condicao_saude_descricao)}`
        : a.tem_condicao_saude === false
          ? 'Não'
          : NA;
    const lesao =
      a.tem_lesao === true
        ? `Sim — ${fmt(a.lesao_descricao)}`
        : a.tem_lesao === false
          ? 'Não'
          : NA;

    const message = `🧪 *Nova anamnese — Aula experimental*

👤 *Nome:* ${fmt(lead?.nome)}
📍 *Unidade:* ${fmt(unidade?.nome)}
📅 *Data da aula:* ${dataAula}

🎯 *Objetivo*
${fmt(a.objetivo)}

🏋️ *Histórico*
${fmt(a.historico)}

📅 *Frequência disponível*
${fmt(a.dias_semana)}

🕒 *Melhor horário*
${fmt(a.preferencia_horario)}

🚧 *Maior obstáculo*
${fmt(a.obstaculo)}

🩺 *Condição de saúde*
${condicao}

⚠️ *Lesão ou limitação*
${lesao}

📝 *Observações*
${fmt(a.observacoes)}

———
_Anamnese preenchida pela recepção no momento da chegada do lead._`;

    // Seleciona o grupo de WhatsApp configurado para a unidade (tabela unidade_whatsapp_config)
    const { data: cfg } = await supabase
      .from('unidade_whatsapp_config')
      .select('grupo_anamnese_id, ativo')
      .eq('unidade_id', a.unidade_id)
      .maybeSingle();

    const nomeUnidade = (unidade?.nome ?? '').toUpperCase();
    const isZS = nomeUnidade.includes('SUL');
    const isZN = nomeUnidade.includes('NORTE');

    const grupo =
      (cfg?.ativo !== false && cfg?.grupo_anamnese_id) ||
      (isZS && Deno.env.get('WHATSAPP_GRUPO_ANAMNESE_ZS')) ||
      (isZN && Deno.env.get('WHATSAPP_GRUPO_ANAMNESE_ZN')) ||
      Deno.env.get('WHATSAPP_GRUPO_ANAMNESE'); // fallback legado

    if (!grupo) {
      console.log('[anamnese] grupo WhatsApp não configurado para a unidade — pulando envio.', {
        unidade: unidade?.nome,
      });
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'no_group' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) throw new Error('Z-API não configurada');

    // [Z-API health] aborta cedo se o chip estiver offline
    {
      const sr = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`, { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN } });
      const sj = await sr.json().catch(() => ({}));
      if (!sr.ok || sj?.connected !== true) {
        console.warn('[notify-anamnese] Z-API offline', sj);
        try {
          const sb = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
          await sb.from('whatsapp_envios_log').insert({ funcao: 'notify-anamnese-experimental', sucesso: false, motivo_skip: 'zapi_offline', erro_msg: JSON.stringify(sj).slice(0, 500) });
        } catch {}
        return new Response(JSON.stringify({ error: 'Z-API desconectado', zapi: sj }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: grupo, message }),
    });
    const result = await resp.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ ok: resp.ok, status: resp.status, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[notify-anamnese] erro', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

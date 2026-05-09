import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NA = 'Não informado';
const fmt = (v: unknown) => {
  if (v === null || v === undefined) return NA;
  if (typeof v === 'string') return v.trim().length > 0 ? v : NA;
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : NA;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
      .select('nome, data_aula_experimental, unidade_id')
      .eq('id', a.lead_id)
      .maybeSingle();
    const { data: unidade } = await supabase
      .from('unidades')
      .select('nome')
      .eq('id', a.unidade_id)
      .maybeSingle();

    const dataAula = lead?.data_aula_experimental
      ? new Date(lead.data_aula_experimental).toLocaleDateString('pt-BR')
      : NA;

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

    const message = `✅ Nova anamnese da aula experimental

👤 Nome: ${fmt(lead?.nome)}
📍 Unidade: ${fmt(unidade?.nome)}
📅 Data da aula: ${dataAula}

🎯 Objetivo:
${fmt(a.objetivo)}

🏋️ Histórico:
${fmt(a.historico)}

📆 Frequência disponível:
${fmt(a.dias_semana)}

🕒 Melhor horário:
${fmt(a.preferencia_horario)}

🚧 Maior obstáculo:
${fmt(a.obstaculo)}

🩺 Condição de saúde:
${condicao}

⚠️ Lesão ou limitação:
${lesao}

📝 Observações:
${fmt(a.observacoes)}

📌 Anamnese preenchida pela recepção no momento da chegada do lead.`;

    // Seleciona o grupo de WhatsApp conforme a unidade do lead
    const nomeUnidade = (unidade?.nome ?? '').toUpperCase();
    const isZS = nomeUnidade.includes('SUL');
    const isZN = nomeUnidade.includes('NORTE');

    const grupo =
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

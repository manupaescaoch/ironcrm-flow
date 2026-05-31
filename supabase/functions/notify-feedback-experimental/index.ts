import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function normalizePhone(phone: string): string {
  let normalized = (phone || '').replace(/\D/g, '');
  if (!normalized) return '';
  if (!normalized.startsWith('55')) normalized = '55' + normalized;
  return normalized;
}

function formatPhoneBR(phone: string): string {
  const n = (phone || '').replace(/\D/g, '');
  // Tenta formatar (55) DD 9XXXX-XXXX
  if (n.length >= 12) {
    const ddd = n.slice(2, 4);
    const rest = n.slice(4);
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return phone || '';
}

function getBrasiliaNow() {
  const now = new Date();
  const brasiliaStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(brasiliaStr);
}

function getBrasiliaDateOnly(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const HOURS_AFTER_CLASS = 3;


async function __zapiStatusCheck() {
  const id = (Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID')); const tk = Deno.env.get('ZAPI_TOKEN');
  const ct = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
  if (!id || !tk) return { connected: false, raw: { error: 'sem credenciais' } };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${id}/token/${tk}/status`, { headers: { 'Client-Token': ct } });
    const j = await r.json().catch(() => ({}));
    return { connected: r.ok && j?.connected === true, raw: j };
  } catch (e) { return { connected: false, raw: { error: String(e) } }; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {

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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID'));
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }


    // [Z-API health] aborta cedo se o chip estiver offline (idem cronograma)
    {
      const __st = await __zapiStatusCheck();
      if (!__st.connected) {
        try {
          const __sb = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(
            Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          await __sb.from('whatsapp_envios_log').insert({
            funcao: 'notify-feedback-experimental',
            sucesso: false, motivo_skip: 'zapi_offline',
            erro_msg: JSON.stringify(__st.raw).slice(0, 500),
          });
        } catch {}
        console.warn('[zapi] offline — abortando', __st.raw);
        return new Response(JSON.stringify({ error: 'Z-API desconectado', zapi: __st.raw }), {
          status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run === true;

    const brasilia = getBrasiliaNow();
    const todayStr = getBrasiliaDateOnly();
    const nowMin = brasilia.getHours() * 60 + brasilia.getMinutes();

    console.log(`[feedback-pos-aula] Brasília: ${brasilia.toISOString()} | hoje=${todayStr} | nowMin=${nowMin}`);

    const { data: interacoes, error: intErr } = await supabase
      .from('interacoes')
      .select('id, lead_id, hora_experimental, data_experimental, compareceu, feedback_pos_aula_enviado_em')
      .eq('data_experimental', todayStr)
      .eq('compareceu', true)
      .is('feedback_pos_aula_enviado_em', null);

    if (intErr) {
      console.error('Erro buscando interações:', intErr);
      return new Response(
        JSON.stringify({ error: intErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!interacoes || interacoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma interação elegível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const elegiveis = interacoes.filter((i: any) => {
      if (!i.hora_experimental) return false;
      const [h, m] = i.hora_experimental.split(':').map((n: string) => parseInt(n, 10));
      const aulaMin = h * 60 + (m || 0);
      const targetMin = aulaMin + HOURS_AFTER_CLASS * 60;
      return nowMin >= targetMin;
    });

    console.log(`[feedback-pos-aula] elegíveis: ${elegiveis.length}/${interacoes.length}`);

    if (elegiveis.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma aula completou 3h ainda' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leadIds = elegiveis.map((e: any) => e.lead_id);
    const { data: leads } = await supabase
      .from('leads')
      .select('id, nome, telefone, ativo, status_funil, is_matriculado, unidade_id')
      .in('id', leadIds);
    const leadMap = new Map((leads || []).map((l: any) => [l.id, l]));

    // Carrega telefones de recepção por unidade
    const unidadeIds = Array.from(new Set((leads || []).map((l: any) => l.unidade_id).filter(Boolean)));
    const { data: cfgs } = await supabase
      .from('unidade_whatsapp_config')
      .select('unidade_id, telefone_recepcao')
      .eq('ativo', true)
      .not('telefone_recepcao', 'is', null)
      .in('unidade_id', unidadeIds);
    const recepcaoMap = new Map((cfgs || []).map((c: any) => [c.unidade_id, c.telefone_recepcao]));

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    let sent = 0;
    const errors: string[] = [];
    const results: any[] = [];

    for (const inter of elegiveis) {
      const lead: any = leadMap.get(inter.lead_id);
      if (!lead) { errors.push(`Lead não encontrado: ${inter.lead_id}`); continue; }
      if (!lead.ativo) { console.log(`[feedback] lead inativo: ${lead.nome}`); continue; }
      if (lead.is_matriculado || lead.status_funil === 'convertido' || lead.status_funil === 'perdido') {
        console.log(`[feedback] lead já matriculado/perdido: ${lead.nome}`);
        await supabase.from('interacoes').update({ feedback_pos_aula_enviado_em: new Date().toISOString() }).eq('id', inter.id);
        continue;
      }

      // Re-check em tempo real
      const { data: freshLead } = await supabase
        .from('leads')
        .select('is_matriculado, status_funil, ativo')
        .eq('id', lead.id)
        .maybeSingle();
      if (!freshLead || !freshLead.ativo || freshLead.is_matriculado || freshLead.status_funil === 'convertido' || freshLead.status_funil === 'perdido') {
        console.log(`[feedback] ⛔ lead virou matrícula/perdido/inativo antes do envio: ${lead.nome}`);
        await supabase.from('interacoes').update({ feedback_pos_aula_enviado_em: new Date().toISOString() }).eq('id', inter.id);
        continue;
      }

      const { data: matricula } = await supabase
        .from('interacoes')
        .select('id')
        .eq('lead_id', lead.id)
        .eq('fechou_matricula', true)
        .maybeSingle();
      if (matricula) {
        console.log(`[feedback] ⛔ lead já tem matrícula registrada: ${lead.nome}`);
        await supabase.from('interacoes').update({ feedback_pos_aula_enviado_em: new Date().toISOString() }).eq('id', inter.id);
        continue;
      }

      const recepcao = recepcaoMap.get(lead.unidade_id);
      if (!recepcao) {
        errors.push(`Sem telefone de recepção para unidade ${lead.unidade_id} (lead ${lead.nome})`);
        continue;
      }

      const horaAula = (inter.hora_experimental || '').slice(0, 5);
      const message = `📞 *Feedback pós-aula experimental*

👤 *Lead:* ${lead.nome}
📱 *Telefone:* ${formatPhoneBR(lead.telefone || '')}
🕒 *Aula:* hoje às ${horaAula}

Entrar em contato para coletar feedback da experiência e oferecer o plano.`;

      const phone = normalizePhone(recepcao);

      if (dryRun) {
        results.push({ lead: lead.nome, destino_recepcao: phone, unidade_id: lead.unidade_id, preview: message });
        continue;
      }

      try {
        const resp = await fetch(zapiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN || '' },
          body: JSON.stringify({ phone, message }),
        });
        const result = await resp.json().catch(() => ({}));

        if (resp.ok) {
          sent++;
          await supabase
            .from('interacoes')
            .update({ feedback_pos_aula_enviado_em: new Date().toISOString() })
            .eq('id', inter.id);

          const { data: cancelados, error: cancelErr } = await supabase
            .from('follow_ups')
            .update({
              status: 'cancelado',
              cancelado_motivo: 'feedback_pos_aula_enviado',
              concluido_em: new Date().toISOString(),
              concluido_por: 'SISTEMA (feedback pós-aula)',
              updated_at: new Date().toISOString(),
            })
            .eq('lead_id', lead.id)
            .eq('tipo', 'D+1')
            .eq('status', 'pendente')
            .select('id');
          if (cancelErr) {
            console.error(`[feedback] ⚠️ erro cancelando D+1 ${lead.nome}`, cancelErr);
          } else if (cancelados && cancelados.length > 0) {
            console.log(`[feedback] 🚫 D+1 cancelado (${cancelados.length}) p/ ${lead.nome}`);
          }

          console.log(`[feedback] ✅ enviado p/ recepção (${phone}) — lead ${lead.nome}`);
        } else {
          console.error(`[feedback] ❌ Z-API ${resp.status} ${lead.nome}`, result);
          errors.push(`Z-API ${resp.status}: ${lead.nome}`);
        }
      } catch (e: any) {
        console.error(`[feedback] erro envio ${lead.nome}`, e);
        errors.push(`Erro envio: ${lead.nome} - ${e?.message ?? e}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, total_eligible: elegiveis.length, errors, dry_run: dryRun, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[feedback-pos-aula] erro geral', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

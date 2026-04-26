import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (!normalized.startsWith('55')) normalized = '55' + normalized;
  return normalized;
}

function getBrasiliaNow() {
  const now = new Date();
  const brasiliaStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  const brasilia = new Date(brasiliaStr);
  return brasilia;
}

function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || full;
}

const HOURS_AFTER_CLASS = 3;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run === true;

    const brasilia = getBrasiliaNow();
    const todayStr = brasilia.toISOString().split('T')[0];
    const nowMin = brasilia.getHours() * 60 + brasilia.getMinutes();

    console.log(`[feedback-pos-aula] Brasília: ${brasilia.toISOString()} | hoje=${todayStr} | nowMin=${nowMin}`);

    // Buscar interações de hoje com presença confirmada e feedback ainda não enviado
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

    // Filtrar pelas que já passaram HOURS_AFTER_CLASS desde a hora_experimental
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
      .select('id, nome, telefone, ativo, status_funil, is_matriculado')
      .in('id', leadIds);
    const leadMap = new Map((leads || []).map((l: any) => [l.id, l]));

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
        // marca como enviado para não tentar de novo
        await supabase.from('interacoes').update({ feedback_pos_aula_enviado_em: new Date().toISOString() }).eq('id', inter.id);
        continue;
      }
      if (!lead.telefone) { errors.push(`Sem telefone: ${lead.nome}`); continue; }

      const nome = firstName(lead.nome);
      const message = `${nome}, e aí? Como foi o treino hoje?

Me fala com sinceridade o que achou da estrutura, do atendimento, do espaço.

E se tiver interesse em continuar treinando aqui na IRON, me fala também. Te explico como funciona sem enrolação.

Equipe IRON`;

      const phone = normalizePhone(lead.telefone);

      if (dryRun) {
        results.push({ lead: lead.nome, phone, preview: message });
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
          console.log(`[feedback] ✅ enviado para ${lead.nome}`);
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

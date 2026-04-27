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

function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || full;
}

const HOURS_AFTER_MATRICULA = 2;

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

    const cutoff = new Date(Date.now() - HOURS_AFTER_MATRICULA * 60 * 60 * 1000).toISOString();

    // Buscar matrículas fechadas há pelo menos 2h e ainda sem boas-vindas enviadas
    const { data: interacoes, error: intErr } = await supabase
      .from('interacoes')
      .select('id, lead_id, data_interacao, fechou_matricula, boas_vindas_enviada_em')
      .eq('fechou_matricula', true)
      .is('boas_vindas_enviada_em', null)
      .lte('data_interacao', cutoff)
      .gte('data_interacao', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (intErr) {
      console.error('Erro buscando matrículas:', intErr);
      return new Response(
        JSON.stringify({ error: intErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!interacoes || interacoes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhuma matrícula elegível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leadIds = interacoes.map((i: any) => i.lead_id);
    const { data: leads } = await supabase
      .from('leads')
      .select('id, nome, telefone, ativo')
      .in('id', leadIds);
    const leadMap = new Map((leads || []).map((l: any) => [l.id, l]));

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    let sent = 0;
    const errors: string[] = [];
    const results: any[] = [];

    for (const inter of interacoes) {
      const lead: any = leadMap.get(inter.lead_id);
      if (!lead) { errors.push(`Lead não encontrado: ${inter.lead_id}`); continue; }
      if (!lead.telefone) { errors.push(`Sem telefone: ${lead.nome}`); continue; }

      const nome = firstName(lead.nome);
      const message = `Olá, ${nome}! Seja muito bem-vindo(a) à família IRON! 💙

Estamos muito felizes em ter você com a gente. Sua jornada de transformação começa agora, e nossa equipe está pronta para te apoiar em cada treino.

Algumas dicas importantes para começar com o pé direito:

✅ Chegue com 10 minutos de antecedência nos seus treinos
✅ Traga sempre uma toalha e garrafa d'água
✅ Qualquer dúvida sobre planos, horários ou treinos, é só chamar aqui

Conte com a gente para alcançar seus objetivos. Vamos juntos! 💪

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
            .update({ boas_vindas_enviada_em: new Date().toISOString() })
            .eq('id', inter.id);
          console.log(`[boas-vindas] ✅ enviado para ${lead.nome}`);
        } else {
          console.error(`[boas-vindas] ❌ Z-API ${resp.status} ${lead.nome}`, result);
          errors.push(`Z-API ${resp.status}: ${lead.nome}`);
        }
      } catch (e: any) {
        console.error(`[boas-vindas] erro envio ${lead.nome}`, e);
        errors.push(`Erro envio: ${lead.nome} - ${e?.message ?? e}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, total_eligible: interacoes.length, errors, dry_run: dryRun, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[boas-vindas-matricula] erro geral', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

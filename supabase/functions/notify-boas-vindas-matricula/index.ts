import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { checkZapiStatus, getZapiCreds, logEnvio, sendText } from '../_shared/zapi.ts';

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
  if (n.length >= 12) {
    const ddd = n.slice(2, 4);
    const rest = n.slice(4);
    if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  return phone || '';
}

const HOURS_AFTER_MATRICULA = 2;
const FUNC = 'notify-boas-vindas-matricula';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: require cron secret header OR valid Supabase JWT for any non-OPTIONS request.
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
    const creds = getZapiCreds('comercial');

    if (!creds) {
      return new Response(
        JSON.stringify({ error: 'ZAPI credentials not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // [Z-API health] aborta cedo se o chip estiver offline (idem cronograma)
    {
      const st = await checkZapiStatus(creds);
      if (!st.connected) {
        await logEnvio(supabase, {
          funcao: FUNC,
          sucesso: false, 
          motivo_skip: 'zapi_offline',
          erro_msg: JSON.stringify(st.raw).slice(0, 500), 
          canal: 'comercial' 
        });
        console.warn('[zapi] offline — abortando', st.raw);
        return new Response(JSON.stringify({ error: 'Z-API desconectado', zapi: st.raw }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    const cutoff = new Date(Date.now() - HOURS_AFTER_MATRICULA * 60 * 60 * 1000).toISOString();

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
      .select('id, nome, telefone, ativo, unidade_id')
      .in('id', leadIds);
    const leadMap = new Map((leads || []).map((l: any) => [l.id, l]));

    const unidadeIds = Array.from(new Set((leads || []).map((l: any) => l.unidade_id).filter(Boolean)));
    const { data: cfgs } = await supabase
      .from('unidade_whatsapp_config')
      .select('unidade_id, telefone_recepcao')
      .eq('ativo', true)
      .not('telefone_recepcao', 'is', null)
      .in('unidade_id', unidadeIds);
    const recepcaoMap = new Map((cfgs || []).map((c: any) => [c.unidade_id, c.telefone_recepcao]));

    for (const inter of interacoes) {
      const lead: any = leadMap.get(inter.lead_id);
      if (!lead) { errors.push(`Lead não encontrado: ${inter.lead_id}`); continue; }

      const recepcao = recepcaoMap.get(lead.unidade_id);
      if (!recepcao) {
        errors.push(`Sem telefone de recepção para unidade ${lead.unidade_id} (aluno ${lead.nome})`);
        continue;
      }

      const message = `🎉 *Nova matrícula*

👤 *Aluno:* ${lead.nome}
📱 *Telefone:* ${formatPhoneBR(lead.telefone || '')}
⏰ *Fechada há:* ~${HOURS_AFTER_MATRICULA}h

Enviar boas-vindas ao aluno e iniciar onboarding.`;

      const phone = normalizePhone(recepcao);

      if (dryRun) {
        results.push({ aluno: lead.nome, destino_recepcao: phone, unidade_id: lead.unidade_id, preview: message });
        continue;
      }

      try {
        const r = await sendText(creds, phone, message);
        
        if (r.ok) {
          sent++;
          await supabase
            .from('interacoes')
            .update({ boas_vindas_enviada_em: new Date().toISOString() })
            .eq('id', inter.id);
          console.log(`[boas-vindas] ✅ enviado p/ recepção (${phone}) — aluno ${lead.nome}`);
          await logEnvio(supabase, {
            funcao: FUNC,
            destino: phone,
            tipo_destino: 'recepcao',
            unidade_id: lead.unidade_id,
            sucesso: true,
            zapi_status_code: r.status,
            canal: 'comercial'
          });
        } else {
          console.error(`[boas-vindas] ❌ Z-API ${r.status} ${lead.nome}`, r.body);
          errors.push(`Z-API ${r.status}: ${lead.nome}`);
          await logEnvio(supabase, {
            funcao: FUNC,
            destino: phone,
            tipo_destino: 'recepcao',
            unidade_id: lead.unidade_id,
            sucesso: false,
            zapi_status_code: r.status,
            erro_msg: JSON.stringify(r.body).slice(0, 500),
            canal: 'comercial'
          });
        }
      } catch (e: any) {
        console.error(`[boas-vindas] erro envio ${lead.nome}`, e);
        errors.push(`Erro envio: ${lead.nome} - ${e?.message ?? e}`);
        await logEnvio(supabase, {
          funcao: FUNC,
          destino: phone,
          tipo_destino: 'recepcao',
          unidade_id: lead.unidade_id,
          sucesso: false,
          erro_msg: e?.message ?? String(e),
          canal: 'comercial'
        });
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

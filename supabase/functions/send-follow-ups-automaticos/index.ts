import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import {
  RATE_LIMIT_MS,
  checkZapiStatus,
  getZapiCreds,
  logEnvio,
  phoneExists,
  sendText,
  sleep,
} from '../_shared/zapi.ts';

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

function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || full;
}

function getBrasiliaParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const dateStr = `${v.year}-${v.month}-${v.day}`;
  const brasiliaDate = new Date(`${dateStr}T12:00:00Z`);
  return { dateStr, dayOfWeek: brasiliaDate.getUTCDay(), hour: Number(v.hour), minute: Number(v.minute) };
}

const TEMPLATES: Record<string, (nome: string) => string> = {
  'D+1': (nome) => `Oi, ${nome}! Tudo bem?

Passando pra saber da experiência com a gente ontem! Como foi o treino? Faz toda a diferença ter um acompanhamento de verdade, né?

Espero que tenha curtido a experiência aqui na IRON. Se fizer sentido pra você continuar treinando com a gente, me chama por aqui que te explico os planos.

Qualquer dúvida, estamos à disposição!`,
  'D+7': (nome) => `Oi, ${nome}! Tudo bem?

Passando pra saber se ficou alguma dúvida depois da sua experiência aqui na IRON.

Muitas vezes a pessoa curte a experiência, mas acaba deixando a decisão para depois por conta da rotina corrida...

Se tiver sido o seu caso, me fala. Podemos concluir sua matrícula por aqui mesmo.

Como trabalhamos com limite de alunos por horário, fico à disposição pra tirar qualquer dúvida e te ajudar a decidir, sem deixar você perder a oportunidade de entrar nesse momento.`,
  'D+15': (nome) => `Oi, ${nome}! Tudo bem?

Passando por aqui porque já faz alguns dias desde sua experiência na IRON.

Quando a pessoa conhece a estrutura, gosta do treino e mesmo assim deixa pra depois, normalmente é por algum detalhe que ficou em aberto.

Como trabalhamos com limite de alunos matriculados, prefiro te chamar antes de encerrar seu atendimento por aqui.

Se a IRON ainda fizer sentido pra você, me fala. Posso te ajudar a tirar qualquer dúvida e ver o melhor caminho pra você começar.`,
  'D+30': (nome) => `Oi, ${nome}!

Passando pra deixar o contato aberto. Se em algum momento quiser treinar com mais acompanhamento e uma experiência diferente, a Iron está aqui.

Qualquer coisa é só chamar. 🤝`,
};

const FUNC = 'send-follow-ups-automaticos';

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

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun = body?.dry_run === true;
    const force = body?.force === true;

    const { dateStr: todayStr, dayOfWeek } = getBrasiliaParts();

    if (!force && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Fim de semana, envio pulado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verifica chip antes de qualquer envio
    if (!dryRun) {
      const st = await checkZapiStatus(creds);
      if (!st.connected) {
        await logEnvio(supabase, { funcao: FUNC, sucesso: false, motivo_skip: 'zapi_offline', erro_msg: JSON.stringify(st.raw).slice(0, 500), canal: 'comercial' });
        return new Response(
          JSON.stringify({ error: 'Z-API desconectado', zapi: st.raw }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
        );
      }
    }

    const { data: followUps, error: fuErr } = await supabase
      .from('follow_ups')
      .select(`
        id, lead_id, tipo, data_prevista, unidade_id,
        leads (id, nome, telefone, ativo, status_funil, is_matriculado)
      `)
      .eq('status', 'pendente')
      .lte('data_prevista', `${todayStr}T23:59:59-03:00`)
      .in('tipo', ['D+1', 'D+7', 'D+15', 'D+30']);

    if (fuErr) {
      return new Response(
        JSON.stringify({ error: fuErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!followUps || followUps.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhum follow-up vencido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sent = 0;
    const errors: string[] = [];
    const results: any[] = [];
    let isFirst = true;

    for (const fu of followUps as any[]) {
      const lead = fu.leads;
      if (!lead) {
        await supabase.from('follow_ups')
          .update({ status: 'cancelado', cancelado_motivo: 'lead_inexistente', updated_at: new Date().toISOString() })
          .eq('id', fu.id);
        continue;
      }
      if (!lead.ativo || lead.is_matriculado || lead.status_funil === 'convertido' || lead.status_funil === 'perdido') {
        await supabase.from('follow_ups')
          .update({ status: 'cancelado', cancelado_motivo: 'lead_inelegivel', updated_at: new Date().toISOString() })
          .eq('id', fu.id);
        continue;
      }
      if (!lead.telefone) {
        await logEnvio(supabase, { funcao: FUNC, tipo_destino: 'lead', unidade_id: fu.unidade_id, sucesso: false, motivo_skip: 'sem_telefone', canal: 'comercial' });
        errors.push(`Sem telefone: ${lead.nome}`);
        continue;
      }

      const tmpl = TEMPLATES[fu.tipo];
      if (!tmpl) continue;

      const message = tmpl(firstName(lead.nome));
      const phone = normalizePhone(lead.telefone);

      if (dryRun) {
        results.push({ tipo: fu.tipo, lead: lead.nome, phone, preview: message });
        continue;
      }

      // Rate limit entre envios (não no primeiro)
      if (!isFirst) await sleep(RATE_LIMIT_MS);
      isFirst = false;

      // Validação phone-exists no WhatsApp
      const exists = await phoneExists(creds, phone);
      if (exists === false) {
        await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', unidade_id: fu.unidade_id, sucesso: false, motivo_skip: 'phone_nao_existe', canal: 'comercial' });
        await supabase.from('follow_ups')
          .update({ status: 'cancelado', cancelado_motivo: 'phone_invalido', updated_at: new Date().toISOString() })
          .eq('id', fu.id);
        errors.push(`Telefone sem WhatsApp: ${lead.nome}`);
        continue;
      }

      try {
        const r = await sendText(creds, phone, message);
        if (r.ok) {
          sent++;
          const nowIso = new Date().toISOString();
          await supabase
            .from('follow_ups')
            .update({ status: 'concluido', concluido_em: nowIso, concluido_por: 'SISTEMA (automático)', updated_at: nowIso })
            .eq('id', fu.id);
          await supabase.from('interacoes').insert({
            lead_id: lead.id,
            unidade_id: fu.unidade_id,
            tipo: 'whatsapp',
            descricao: `Follow-up ${fu.tipo} enviado automaticamente via WhatsApp`,
            data_interacao: nowIso,
            atendido_por: 'SISTEMA',
          });
          await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', unidade_id: fu.unidade_id, sucesso: true, zapi_status_code: r.status, canal: 'comercial' });
          results.push({ tipo: fu.tipo, lead: lead.nome, status: 'sent' });
        } else {
          await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', unidade_id: fu.unidade_id, sucesso: false, zapi_status_code: r.status, erro_msg: JSON.stringify(r.body).slice(0, 500), canal: 'comercial' });
          errors.push(`Z-API ${r.status}: ${fu.tipo} ${lead.nome}`);
        }
      } catch (e: any) {
        await logEnvio(supabase, { funcao: FUNC, destino: phone, tipo_destino: 'lead', unidade_id: fu.unidade_id, sucesso: false, erro_msg: e?.message ?? String(e), canal: 'comercial' });
        errors.push(`Erro envio: ${fu.tipo} ${lead.nome} - ${e?.message ?? e}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent, total_eligible: followUps.length, errors, dry_run: dryRun, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

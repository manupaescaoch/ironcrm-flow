import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function getBrasiliaNow() {
  // Mantém compatibilidade — retorna Date com wall-clock Brasília simulado
  const now = new Date();
  const brasiliaStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(brasiliaStr);
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
    const force = body?.force === true; // ignora check de fim de semana

    const brasilia = getBrasiliaNow();
    const dayOfWeek = brasilia.getDay(); // 0=dom, 6=sab
    const todayStr = brasilia.toISOString().split('T')[0];

    // Bloquear envio em fim de semana (a menos que force=true)
    if (!force && (dayOfWeek === 0 || dayOfWeek === 6)) {
      console.log(`[follow-ups-auto] Pulando envio: fim de semana (dia ${dayOfWeek})`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Fim de semana, envio pulado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { dateStr: todayStr, dayOfWeek } = getBrasiliaParts();

    // Bloquear envio em fim de semana (a menos que force=true) — sobrescreve checagem acima
    if (!force && (dayOfWeek === 0 || dayOfWeek === 6)) {
      console.log(`[follow-ups-auto] Pulando envio: fim de semana (dia ${dayOfWeek})`);
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Fim de semana, envio pulado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[follow-ups-auto] Brasília hoje=${todayStr}`);

    // Buscar follow-ups pendentes com data_prevista <= hoje
    const { data: followUps, error: fuErr } = await supabase
      .from('follow_ups')
      .select(`
        id, lead_id, tipo, data_prevista, unidade_id,
        leads (id, nome, telefone, ativo, status_funil, is_matriculado)
      `)
      .eq('status', 'pendente')
      .lte('data_prevista', `${todayStr}T23:59:59`)
      .in('tipo', ['D+1', 'D+7', 'D+15', 'D+30']);

    if (fuErr) {
      console.error('Erro buscando follow-ups:', fuErr);
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

    console.log(`[follow-ups-auto] ${followUps.length} follow-ups vencidos encontrados`);

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    let sent = 0;
    const errors: string[] = [];
    const results: any[] = [];

    for (const fu of followUps as any[]) {
      const lead = fu.leads;
      if (!lead) {
        errors.push(`Lead não encontrado: fu=${fu.id}`);
        await supabase.from('follow_ups')
          .update({ status: 'cancelado', cancelado_motivo: 'lead_inexistente', updated_at: new Date().toISOString() })
          .eq('id', fu.id);
        continue;
      }
      // Filtros de elegibilidade
      if (!lead.ativo || lead.is_matriculado || lead.status_funil === 'convertido' || lead.status_funil === 'perdido') {
        console.log(`[follow-ups-auto] Cancelando ${fu.tipo} - ${lead.nome} (inelegível)`);
        await supabase.from('follow_ups')
          .update({ status: 'cancelado', cancelado_motivo: 'lead_inelegivel', updated_at: new Date().toISOString() })
          .eq('id', fu.id);
        continue;
      }
      if (!lead.telefone) {
        errors.push(`Sem telefone: ${lead.nome}`);
        continue;
      }

      const tmpl = TEMPLATES[fu.tipo];
      if (!tmpl) {
        errors.push(`Template não encontrado: ${fu.tipo}`);
        continue;
      }

      const nome = firstName(lead.nome);
      const message = tmpl(nome);
      const phone = normalizePhone(lead.telefone);

      if (dryRun) {
        results.push({ tipo: fu.tipo, lead: lead.nome, phone, preview: message });
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
          const nowIso = new Date().toISOString();
          // Marcar follow-up como concluído
          await supabase
            .from('follow_ups')
            .update({
              status: 'concluido',
              concluido_em: nowIso,
              concluido_por: 'SISTEMA (automático)',
              updated_at: nowIso,
            })
            .eq('id', fu.id);

          // Registrar interação no histórico do lead
          await supabase.from('interacoes').insert({
            lead_id: lead.id,
            unidade_id: fu.unidade_id,
            tipo: 'whatsapp',
            descricao: `Follow-up ${fu.tipo} enviado automaticamente via WhatsApp`,
            data_interacao: nowIso,
            atendido_por: 'SISTEMA',
          });

          console.log(`[follow-ups-auto] ✅ ${fu.tipo} enviado para ${lead.nome}`);
          results.push({ tipo: fu.tipo, lead: lead.nome, status: 'sent' });
        } else {
          console.error(`[follow-ups-auto] ❌ Z-API ${resp.status} ${lead.nome}`, result);
          errors.push(`Z-API ${resp.status}: ${fu.tipo} ${lead.nome}`);
        }
      } catch (e: any) {
        console.error(`[follow-ups-auto] erro envio ${lead.nome}`, e);
        errors.push(`Erro envio: ${fu.tipo} ${lead.nome} - ${e?.message ?? e}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        total_eligible: followUps.length,
        errors,
        dry_run: dryRun,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[follow-ups-auto] erro geral', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

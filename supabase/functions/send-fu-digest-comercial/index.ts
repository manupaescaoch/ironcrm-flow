// Envia 1 mensagem por unidade ao GRUPO COMERCIAL com a lista de follow-ups
// pendentes do dia. NÃO conclui os follow-ups — humano marca manualmente na CRM.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { buildIdempotencyKey, checkZapiStatus, getZapiCreds, logEnvio, sendTextIdempotent } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FUNC = 'send-fu-digest-comercial';

function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] || full;
}

function formatPhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  // 55 11 99999-9999 -> remove 55, mostra (11) 99999-9999
  const n = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return raw;
}

function getBrasiliaParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { dateStr: `${v.year}-${v.month}-${v.day}`, dateBR: `${v.day}/${v.month}/${v.year}` };
}

const TEMPLATES: Record<string, (nome: string) => string> = {
  'D+1': (n) => `Oi, ${n}! Tudo bem? Passando pra saber da sua experiência ontem na IRON. Como foi o treino? Se fizer sentido continuar, me chama por aqui que te explico os planos.`,
  'D+7': (n) => `Oi, ${n}! Tudo bem? Passando pra saber se ficou alguma dúvida depois da sua experiência aqui na IRON. Se quiser concluir sua matrícula, é só me chamar.`,
  'D+15': (n) => `Oi, ${n}! Tudo bem? Já faz alguns dias desde sua experiência. Como trabalhamos com limite de alunos, prefiro te chamar antes de encerrar seu atendimento. Se a IRON ainda fizer sentido, me fala.`,
  'D+30': (n) => `Oi, ${n}! Passando pra deixar o contato aberto. Se em algum momento quiser treinar com mais acompanhamento, a IRON está aqui. 🤝`,
};

function daysOverdue(dataPrevista: string): number {
  const due = new Date(dataPrevista);
  const today = new Date();
  return Math.floor((today.getTime() - due.getTime()) / 86400000);
}

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const targetUnidadeId: string | null = body?.unidade_id ?? null;
    const dryRun: boolean = body?.dry_run === true;

    if (!dryRun && !creds) {
      return new Response(JSON.stringify({ error: 'ZAPI not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }

    // [Z-API health] aborta cedo se o chip estiver offline
    if (!dryRun && creds) {
      const st = await checkZapiStatus(creds);
      if (!st.connected) {
        await logEnvio(supabase, { 
          funcao: FUNC, 
          sucesso: false, 
          motivo_skip: 'zapi_offline', 
          erro_msg: JSON.stringify(st.raw).slice(0, 500), 
          canal: 'comercial' 
        });
        return new Response(JSON.stringify({ error: 'Z-API desconectado', zapi: st.raw }), { 
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    const { dateStr: todayStr, dateBR } = getBrasiliaParts();

    // 1. Carregar configs ativas (filtra unidade se foi pedido)
    let configQ = supabase.from('unidade_whatsapp_config')
      .select('unidade_id, grupo_fu_id, grupo_fu_nome')
      .eq('ativo', true)
      .not('grupo_fu_id', 'is', null);
    if (targetUnidadeId) configQ = configQ.eq('unidade_id', targetUnidadeId);
    const { data: configs, error: cfgErr } = await configQ;
    if (cfgErr) throw cfgErr;

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Nenhuma unidade configurada', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Carregar follow-ups pendentes vencidos
    const { data: follows, error: fuErr } = await supabase
      .from('follow_ups')
      .select('id, tipo, data_prevista, unidade_id, leads(id, nome, telefone, ativo, status_funil, is_matriculado)')
      .eq('status', 'pendente')
      .lte('data_prevista', `${todayStr}T23:59:59`)
      .in('tipo', ['D+1', 'D+7', 'D+15', 'D+30']);
    if (fuErr) throw fuErr;

    // 3. Carregar nomes das unidades
    const unidadeIds = configs.map(c => c.unidade_id);
    const { data: unidades } = await supabase.from('unidades').select('id, nome').in('id', unidadeIds);
    const unidadeNome = new Map((unidades ?? []).map((u: any) => [u.id, u.nome]));

    
    const results: any[] = [];

    for (const cfg of configs) {
      const fusUnidade = (follows ?? []).filter((f: any) => {
        if (f.unidade_id !== cfg.unidade_id) return false;
        const l = f.leads;
        return l && l.ativo && !l.is_matriculado && !['convertido', 'perdido'].includes(l.status_funil) && l.telefone;
      });

      if (fusUnidade.length === 0) {
        results.push({ unidade_id: cfg.unidade_id, status: 'empty' });
        continue;
      }

      // Idempotência: 1 envio por unidade por dia
      const idemKey = `fu-digest|${cfg.unidade_id}|${todayStr}`;
      const { data: existing } = await supabase.from('formulario_envios_log')
        .select('id, status').eq('idempotency_key', idemKey).maybeSingle();
      if (existing && existing.status === 'enviado' && !dryRun) {
        results.push({ unidade_id: cfg.unidade_id, status: 'duplicate' });
        continue;
      }

      // Ordenar: tipo (D+1 primeiro) e depois vencimento
      const order: Record<string, number> = { 'D+1': 1, 'D+7': 2, 'D+15': 3, 'D+30': 4 };
      fusUnidade.sort((a: any, b: any) => (order[a.tipo] - order[b.tipo]) || a.data_prevista.localeCompare(b.data_prevista));

      const nome = unidadeNome.get(cfg.unidade_id) || 'UNIDADE';
      const linhas = fusUnidade.map((f: any, i: number) => {
        const l = f.leads;
        const tmpl = TEMPLATES[f.tipo]?.(firstName(l.nome)) || '';
        const overdue = daysOverdue(f.data_prevista);
        const overdueTxt = overdue > 0 ? `vencido há ${overdue} dia(s)` : 'hoje';
        return `${i + 1}. *${l.nome}* — ${formatPhone(l.telefone)}\n   Tipo: ${f.tipo}  •  ${overdueTxt}\n   ↳ Mensagem sugerida:\n   "${tmpl}"`;
      }).join('\n\n');

      const message =
`📋 *FOLLOW-UPS DO DIA — ${nome}*
${dateBR}

Total pendente: ${fusUnidade.length}

${linhas}

━━━━━━━━━━━━━━━
⚠️ Após enviar, marque o lead como contatado na CRM.`;

      if (dryRun) {
        results.push({ unidade_id: cfg.unidade_id, status: 'dry_run', preview: message, n: fusUnidade.length });
        continue;
      }

      // Envia ao grupo
      try {
        const chave = buildIdempotencyKey([FUNC, cfg.unidade_id, todayStr, cfg.grupo_fu_id]);
        const r = await sendTextIdempotent(supabase, creds!, cfg.grupo_fu_id, message, { chave, funcao: FUNC });
        if (r.skipped) {
          results.push({ unidade_id: cfg.unidade_id, status: 'duplicate' });
          continue;
        }
        const ok = r.ok;

        await logEnvio(supabase, {
          funcao: FUNC,
          destino: String(cfg.grupo_fu_id),
          tipo_destino: 'grupo',
          unidade_id: cfg.unidade_id,
          sucesso: ok,
          erro_msg: ok ? null : JSON.stringify(r.body).slice(0, 500),
          zapi_status_code: r.status,
          canal: 'comercial',
        });

        await supabase.from('formulario_envios_log').upsert({
          idempotency_key: idemKey,
          tipo_formulario: 'fu_digest_comercial',
          unidade: nome,
          unidade_id: cfg.unidade_id,
          origem: 'cron',
          status: ok ? 'enviado' : 'erro',
          sent_at: ok ? new Date().toISOString() : null,
          error_message: ok ? null : `HTTP ${r.status}`,
        }, { onConflict: 'idempotency_key' });

        results.push({ unidade_id: cfg.unidade_id, status: ok ? 'sent' : 'error', n: fusUnidade.length });
      } catch (e: any) {
        results.push({ unidade_id: cfg.unidade_id, status: 'error', error: e?.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, dateStr: todayStr, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[fu-digest] erro', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

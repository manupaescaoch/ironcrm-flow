// Envia ao TELEFONE DA RECEPÇÃO de cada unidade a lista consolidada de
// confirmações de aula experimental que precisam ser disparadas (24h e 2h antes).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { checkZapiStatus, getZapiCreds, logEnvio, sendText } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FUNC = 'send-confirmacao-recepcao';
const TZ = 'America/Sao_Paulo';

function brasiliaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    dateStr: `${v.year}-${v.month}-${v.day}`,
    dateBR: `${v.day}/${v.month}/${v.year}`,
    timeBR: `${v.hour}:${v.minute}`,
    nowUtc: new Date(),
  };
}

function firstName(n: string) { return (n || '').trim().split(/\s+/)[0] || n; }
function formatPhone(raw: string): string {
  const d = (raw || '').replace(/\D/g, '');
  const n = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
  return raw;
}
function normalizePhone(raw: string) {
  const d = (raw || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('55') ? d : `55${d}`;
}

const ANAMNESE_URL = 'https://ironclub-app.com/anamnese';

function template24h(nome: string, dataBR: string, hora: string) {
  return `Oi, ${nome}! Tudo certo, sua experimental está confirmada! 🔵\n\n📅 ${dataBR} ⏰ ${hora}\n\nChega 15 minutinhos antes, tá? Qualquer imprevisto é só me chamar.\n\nEquipe Iron`;
}
function template2h(nome: string, hora: string) {
  return `Oi, ${nome}! Daqui a pouco é hora do treino. 💪\n\nPreenche essa ficha rapidinho:\n👉 ${ANAMNESE_URL}\n\nTe esperamos às ${hora}. Qualquer imprevisto é só me chamar. 🔵\n\nEquipe Iron`;
}

// Combina data (YYYY-MM-DD) + hora (HH:MM:SS) em UTC ms assumindo timezone Brasília (-03)
function brasiliaToUtcMs(dateStr: string, timeStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.slice(0, 5).split(':').map(Number);
  // Brasília = UTC-3
  return Date.UTC(y, m - 1, d, hh + 3, mm, 0);
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
    // ⚠️ DESCONTINUADA — confirmação experimental agora vai DIRETO ao lead via
    // `confirmacao-experimental-automatica`. Esta função fica apenas como fallback manual.
    const creds = getZapiCreds('comercial');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: any = {};
    try { body = await req.json(); } catch {}
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

    const { dateStr, dateBR, timeBR, nowUtc } = brasiliaNow();
    const nowMs = nowUtc.getTime();
    const WINDOW = 30 * 60 * 1000; // 30 minutos para cada lado

    // Configs
    let cQ = supabase.from('unidade_whatsapp_config')
      .select('unidade_id, telefone_recepcao').eq('ativo', true)
      .not('telefone_recepcao', 'is', null);
    if (targetUnidadeId) cQ = cQ.eq('unidade_id', targetUnidadeId);
    const { data: configs, error: cErr } = await cQ;
    if (cErr) throw cErr;
    if (!configs?.length) {
      return new Response(JSON.stringify({ success: true, message: 'sem recepção configurada', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar leads com aula nas próximas ~26h
    const hojeStr = dateStr;
    const amanha = new Date(Date.UTC(
      Number(dateStr.slice(0,4)),
      Number(dateStr.slice(5,7)) - 1,
      Number(dateStr.slice(8,10)) + 1
    ));
    const amanhaStr = `${amanha.getUTCFullYear()}-${String(amanha.getUTCMonth()+1).padStart(2,'0')}-${String(amanha.getUTCDate()).padStart(2,'0')}`;

    const unidadeIds = configs.map(c => c.unidade_id);

    const { data: leads, error: lErr } = await supabase
      .from('leads')
      .select('id, nome, telefone, unidade_id, data_aula_experimental, hora_aula_experimental, confirmacao_24h_enviada_em, confirmacao_2h_enviada_em, ativo, status_funil')
      .in('unidade_id', unidadeIds)
      .in('data_aula_experimental', [hojeStr, amanhaStr])
      .eq('ativo', true)
      .not('hora_aula_experimental', 'is', null)
      .not('telefone', 'is', null);
    if (lErr) throw lErr;

    const { data: unidades } = await supabase.from('unidades').select('id, nome').in('id', unidadeIds);
    const unidadeNome = new Map((unidades ?? []).map((u: any) => [u.id, u.nome]));

    const results: any[] = [];
    const idsParaMarcar24: string[] = [];
    const idsParaMarcar2: string[] = [];

    for (const cfg of configs) {
      const leadsUnid = (leads ?? []).filter((l: any) => l.unidade_id === cfg.unidade_id);
      const itens24: any[] = [];
      const itens2: any[] = [];

      for (const l of leadsUnid) {
        if (l.status_funil === 'perdido' || l.status_funil === 'convertido') continue;
        const aulaMs = brasiliaToUtcMs(l.data_aula_experimental, l.hora_aula_experimental);
        const diffH = (aulaMs - nowMs) / 3600000;

        // janela 24h: 23.5h a 24.5h e ainda não enviado
        if (!l.confirmacao_24h_enviada_em && diffH >= 23.5 && diffH <= 24.5) {
          itens24.push({ ...l, aulaMs });
          idsParaMarcar24.push(l.id);
        }
        // janela 2h: 1.5h a 2.5h e ainda não enviado
        if (!l.confirmacao_2h_enviada_em && diffH >= 1.5 && diffH <= 2.5) {
          itens2.push({ ...l, aulaMs });
          idsParaMarcar2.push(l.id);
        }
      }

      if (itens24.length === 0 && itens2.length === 0) {
        results.push({ unidade_id: cfg.unidade_id, status: 'empty' });
        continue;
      }

      const nome = unidadeNome.get(cfg.unidade_id) || 'UNIDADE';
      const fmtItens = (arr: any[], tmplFn: (n: string, d: string, h: string) => string) => arr
        .sort((a, b) => a.aulaMs - b.aulaMs)
        .map((l, i) => {
          const horaUI = (l.hora_aula_experimental || '').slice(0, 5);
          const dataParts = l.data_aula_experimental.split('-');
          const dataLabel = `${dataParts[2]}/${dataParts[1]}`;
          const tmpl = tmplFn(firstName(l.nome), dataLabel, horaUI);
          return `${i + 1}. *${l.nome}* — ${formatPhone(l.telefone)} — ${dataLabel} às ${horaUI}\n   ↳ "${tmpl}"`;
        })
        .join('\n\n');

      const blocos: string[] = [];
      if (itens24.length) blocos.push(`⏰ *EM 24H* (${itens24.length})\n\n${fmtItens(itens24, (n, d, h) => template24h(n, d, h))}`);
      if (itens2.length)  blocos.push(`⏰ *EM 2H* (${itens2.length})\n\n${fmtItens(itens2, (n, _d, h) => template2h(n, h))}`);

      const message =
`📞 *CONFIRMAÇÕES DE EXPERIMENTAL — ${nome}*
${dateBR} • ${timeBR}

${blocos.join('\n\n━━━━━━━━━━━━━━━\n\n')}

━━━━━━━━━━━━━━━
⚠️ Envie do número da unidade. As mensagens já foram marcadas como enviadas no sistema.`;

      if (dryRun) {
        results.push({ unidade_id: cfg.unidade_id, status: 'dry_run', preview: message, n: itens24.length + itens2.length });
        continue;
      }

      try {
        const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
          body: JSON.stringify({ phone: normalizePhone(cfg.telefone_recepcao), message }),
        });
        const ok = resp.ok;
        await resp.text();

        const slot = `${dateStr}T${timeBR.replace(':','')}`;
        await supabase.from('formulario_envios_log').upsert({
          idempotency_key: `conf-recep|${cfg.unidade_id}|${slot}`,
          tipo_formulario: 'confirmacao_recepcao',
          unidade: nome,
          unidade_id: cfg.unidade_id,
          origem: 'cron',
          status: ok ? 'enviado' : 'erro',
          sent_at: ok ? new Date().toISOString() : null,
          error_message: ok ? null : `HTTP ${resp.status}`,
        }, { onConflict: 'idempotency_key' });

        results.push({ unidade_id: cfg.unidade_id, status: ok ? 'sent' : 'error', n24: itens24.length, n2: itens2.length });
      } catch (e: any) {
        results.push({ unidade_id: cfg.unidade_id, status: 'error', error: e?.message });
      }
    }

    // Marcar flags em batch (somente se NÃO for dry-run)
    if (!dryRun) {
      const nowIso = new Date().toISOString();
      if (idsParaMarcar24.length) {
        await supabase.from('leads').update({ confirmacao_24h_enviada_em: nowIso }).in('id', idsParaMarcar24);
      }
      if (idsParaMarcar2.length) {
        await supabase.from('leads').update({ confirmacao_2h_enviada_em: nowIso }).in('id', idsParaMarcar2);
      }
    }

    return new Response(JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[conf-recepcao] erro', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});

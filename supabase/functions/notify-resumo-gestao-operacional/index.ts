import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { buildIdempotencyKey, getZapiCreds, sendTextIdempotent } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const ZN_ID = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
const ZS_ID = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';
const DEFAULT_DEST_PHONE = '5581996392285';

function getBrasiliaDate(): Date {
  const now = new Date();
  const str = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(str);
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function pct(num: number, den: number): string {
  if (!den) return '0%';
  return `${Math.round((num / den) * 100)}%`;
}

function diffPct(current: number, previous: number): string {
  if (previous === 0) return previous === current ? '0%' : '—';
  const diff = ((current - previous) / previous) * 100;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${Math.round(diff)}%`;
}

async function getStats(supabase: any, unidadeId: string | null) {
  const now = getBrasiliaDate();
  
  // Current Week (Sunday to Saturday)
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  
  const lastSunday = new Date(sunday);
  lastSunday.setDate(sunday.getDate() - 7);
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(23, 59, 59, 999);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // 1. Metas & Fixed Stats
  let metaQuery = supabase.from('gestao_metas').select('*');
  if (unidadeId) metaQuery = metaQuery.eq('unidade_id', unidadeId);
  const { data: metas } = await metaQuery;
  
  const totalAtivos = (metas || []).reduce((acc: number, m: any) => acc + (m.alunos_ativos_manual || 0), 0);
  const totalMetaAlunos = (metas || []).reduce((acc: number, m: any) => acc + (m.meta_alunos_mes || 0), 0);
  const avgTicket = (metas || []).reduce((acc: number, m: any) => acc + (m.ticket_medio_real || 0), 0) / (metas?.length || 1);
  const avgEvasao = (metas || []).reduce((acc: number, m: any) => acc + (m.evasao_pct_manual || 0), 0) / (metas?.length || 1);
  const totalRecorrente = (metas || []).reduce((acc: number, m: any) => acc + ((m.alunos_ativos_manual || 0) * (m.ticket_medio_real || 0)), 0);

  // 2. Matrículas (Current Week vs Last Week)
  let matQuery = supabase.from('interacoes')
    .select('id, data_fechamento')
    .eq('fechou_matricula', true);
  if (unidadeId) matQuery = matQuery.eq('unidade_id', unidadeId);
  
  const { data: allMats } = await matQuery;
  const matsThisWeek = (allMats || []).filter((m: any) => new Date(m.data_fechamento + 'T12:00:00') >= sunday).length;
  const matsLastWeek = (allMats || []).filter((m: any) => {
    const d = new Date(m.data_fechamento + 'T12:00:00');
    return d >= lastSunday && d < sunday;
  }).length;

  // 3. Comparecimento (Experimentais)
  let expQuery = supabase.from('interacoes')
    .select('id, compareceu, data_experimental')
    .not('data_experimental', 'is', null);
  if (unidadeId) expQuery = expQuery.eq('unidade_id', unidadeId);
  
  const { data: allExps } = await expQuery;
  const expsThisWeek = (allExps || []).filter((e: any) => new Date(e.data_experimental + 'T12:00:00') >= sunday);
  const expsLastWeek = (allExps || []).filter((e: any) => {
    const d = new Date(e.data_experimental + 'T12:00:00');
    return d >= lastSunday && d < sunday;
  });

  const compThisWeek = pct(expsThisWeek.filter((e: any) => e.compareceu).length, expsThisWeek.length);
  const compLastWeek = pct(expsLastWeek.filter((e: any) => e.compareceu).length, expsLastWeek.length);

  // 4. Conversão EXP -> MAT
  // (Matrículas fechadas que tiveram experimental no período OU Matrículas no período / Experimentais no período)
  // O usuário no exemplo parece usar Matrículas no período / Experimentais Realizadas no período.
  const convThisWeek = pct(matsThisWeek, expsThisWeek.filter((e: any) => e.compareceu).length);
  const convLastWeek = pct(matsLastWeek, expsLastWeek.filter((e: any) => e.compareceu).length);

  // 5. Receita
  let recQuery = supabase.from('interacoes')
    .select('valor_plano, data_fechamento')
    .eq('fechou_matricula', true);
  if (unidadeId) recQuery = recQuery.eq('unidade_id', unidadeId);
  
  const { data: allRecs } = await recQuery;
  const recMonth = (allRecs || []).filter((r: any) => new Date(r.data_fechamento + 'T12:00:00') >= monthStart)
    .reduce((acc: number, r: any) => acc + Number(r.valor_plano || 0), 0);
  const recLastMonth = (allRecs || []).filter((r: any) => {
    const d = new Date(r.data_fechamento + 'T12:00:00');
    return d >= prevMonthStart && d <= prevMonthEnd;
  }).reduce((acc: number, r: any) => acc + Number(r.valor_plano || 0), 0);

  // 6. Follow-ups
  let fuQuery = supabase.from('follow_ups')
    .select('id, status, data_prevista')
    .eq('status', 'pendente');
  if (unidadeId) fuQuery = fuQuery.eq('unidade_id', unidadeId);
  
  const { data: fus } = await fuQuery;
  const totalFus = fus?.length || 0;
  const atrasados = (fus || []).filter((f: any) => new Date(f.data_prevista) < now).length;

  return {
    ativos: totalAtivos,
    meta: totalMetaAlunos,
    matsWeek: matsThisWeek,
    matsPrev: matsLastWeek,
    fuAtrasados: atrasados,
    fuTotal: totalFus,
    comp: compThisWeek,
    compPrev: compLastWeek,
    conv: convThisWeek,
    convPrev: convLastWeek,
    receita: recMonth,
    receitaPrev: recLastMonth,
    ticket: avgTicket,
    recorrente: totalRecorrente,
    evasao: avgEvasao
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const __auth = await authorizeCronOrJwt(req);
  if (!__auth.ok) {
    return new Response(JSON.stringify({ error: __auth.error }), { status: __auth.status, headers: corsHeaders });
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    
    let body: any = {};
    try { body = await req.json(); } catch { /* body opcional */ }
    const destPhone = body?.phone || DEFAULT_DEST_PHONE;

    const consolidated = await getStats(supabase, null);
    const zn = await getStats(supabase, ZN_ID);
    const zs = await getStats(supabase, ZS_ID);

    const now = getBrasiliaDate();
    const dataHora = now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(',', '');

    // Foco do dia: lógica simples baseada nos dados
    const focos = [];
    if (zs.fuAtrasados > 0 || zs.fuTotal > 50) focos.push('Revisar follow-ups pendentes na Zona Sul');
    if (zn.fuAtrasados > 0 || zn.fuTotal > 50) focos.push('Revisar follow-ups pendentes na Zona Norte');
    if (parseFloat(zs.comp) < 60) focos.push('Recuperar comparecimento na Zona Sul');
    if (parseFloat(zn.comp) < 60) focos.push('Recuperar comparecimento na Zona Norte');
    if (focos.length === 0) focos.push('Manter o ritmo de matrículas e follow-ups');

    const message = `📊 *GESTÃO OPERACIONAL IRON CLUB*
Atualização: ${dataHora}

🏋️ *CONSOLIDADO*

Alunos ativos: ${consolidated.ativos}
Meta: ${consolidated.ativos} / ${consolidated.meta}
Realizado: ${pct(consolidated.ativos, consolidated.meta)}
Faltam: ${Math.max(0, consolidated.meta - consolidated.ativos)} alunos

Matrículas da semana: ${consolidated.matsWeek}
Semana anterior: ${consolidated.matsPrev}
Variação: ${diffPct(consolidated.matsWeek, consolidated.matsPrev)}

Follow-ups atrasados: ${consolidated.fuAtrasados}
Pendentes no total: ${consolidated.fuTotal}

━━━━━━━━━━━━━━

📍 *ZONA NORTE*

Alunos ativos: ${zn.ativos}
Meta: ${zn.ativos} / ${zn.meta}
Realizado: ${pct(zn.ativos, zn.meta)}
Faltam: ${Math.max(0, zn.meta - zn.ativos)} alunos

Matrículas: ${zn.matsWeek}
Semana anterior: ${zn.matsPrev}
Variação: ${diffPct(zn.matsWeek, zn.matsPrev)}

Comparecimento: ${zn.comp}
Semana anterior: ${zn.compPrev}

Conversão EXP → MAT: ${zn.conv}
Semana anterior: ${zn.convPrev}

Receita do mês: ${fmtBRL(zn.receita)}
Mês anterior: ${fmtBRL(zn.receitaPrev)}
Variação: ${diffPct(zn.receita, zn.receitaPrev)}

Ticket médio: ${fmtBRL(zn.ticket)}
Receita recorrente projetada: ${fmtBRL(zn.ativos * zn.ticket)}

Follow-ups atrasados: ${zn.fuAtrasados}
Pendentes no total: ${zn.fuTotal}

Evasão: ${zn.evasao}%

━━━━━━━━━━━━━━

📍 *ZONA SUL*

Alunos ativos: ${zs.ativos}
Meta: ${zs.ativos} / ${zs.meta}
Realizado: ${pct(zs.ativos, zs.meta)}
Faltam: ${Math.max(0, zs.meta - zs.ativos)} alunos

Matrículas: ${zs.matsWeek}
Semana anterior: ${zs.matsPrev}
Variação: ${diffPct(zs.matsWeek, zs.matsPrev)}

Comparecimento: ${zs.comp}
Semana anterior: ${zs.compPrev}

Conversão EXP → MAT: ${zs.conv}
Semana anterior: ${zs.convPrev}

Receita do mês: ${fmtBRL(zs.receita)}
Mês anterior: ${fmtBRL(zs.receitaPrev)}
Variação: ${diffPct(zs.receita, zs.receitaPrev)}

Ticket médio: ${fmtBRL(zs.ticket)}
Receita recorrente projetada: ${fmtBRL(zs.ativos * zs.ticket)}

Follow-ups atrasados: ${zs.fuAtrasados}
Pendentes no total: ${zs.fuTotal}

Evasão: ${zs.evasao}%

━━━━━━━━━━━━━━

✅ *FOCO DO DIA*

${focos.join(', ')}.`;

    const creds = getZapiCreds('comercial');
    if (!creds) {
       return new Response(JSON.stringify({ error: 'ZAPI Comercial credentials missing' }), { status: 500, headers: corsHeaders });
    }
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    const chave = buildIdempotencyKey(['notify-resumo-gestao-operacional', dateStr, destPhone]);
    const resp = await sendTextIdempotent(supabase, creds, destPhone, message, { chave, funcao: 'notify-resumo-gestao-operacional' });

    return new Response(JSON.stringify({ success: resp.ok || resp.skipped, status: resp.status, duplicate: resp.skipped, message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

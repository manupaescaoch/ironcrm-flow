// Envia resumo operacional diário (08:05 BRT) das duas unidades Iron Club
// diretamente ao WhatsApp da Manu Paes, via chip COMERCIAL.
//
// Pode ser chamado:
//  - pelo pg_cron (X-Cron-Secret)
//  - por admin logado via UI (body { dry_run?: boolean, destino?: string })
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const MANU_PHONE_DEFAULT = '5581996392285'; // Manu Paes

const fmtBRL = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

function pctVar(curr: number, prev: number): string {
  if (!isFinite(curr) || !isFinite(prev)) return '—';
  if (prev === 0 && curr === 0) return '0%';
  if (prev === 0) return curr > 0 ? '+100%' : '0%';
  const diff = Math.round(((curr - prev) / prev) * 100);
  return `${diff > 0 ? '+' : ''}${diff}%`;
}

function ppVar(curr: number, prev: number): string {
  if (curr == null || prev == null) return '—';
  const diff = Math.round(curr - prev);
  return `${diff > 0 ? '+' : ''}${diff}pp`;
}

function brasiliaParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    dateStr: `${v.year}-${v.month}-${v.day}`,
    dateBR: `${v.day}/${v.month}/${v.year}`,
    horaBR: `${v.hour}:${v.minute}`,
  };
}

function mondayOf(d: Date): Date { const x = new Date(d); const day = x.getDay(); const diff = (day === 0 ? -6 : 1 - day); x.setDate(x.getDate() + diff); x.setHours(0,0,0,0); return x; }
function sundayOf(d: Date): Date { const m = mondayOf(d); const s = new Date(m); s.setDate(m.getDate() + 6); s.setHours(23,59,59,999); return s; }
function subWeeks(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() - 7 * n); return x; }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23,59,59,999); }
function fmtDate(d: Date): string {
  const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

interface UnidadeKPIs {
  unidade_id: string;
  unidade_nome: string;
  alunos_ativos: number;
  meta_alunos: number;
  pct_meta: number;
  faltam_meta: number;
  matriculas_semana: number;
  matriculas_semana_anterior: number;
  comparecimento: number;
  comparecimento_anterior: number;
  conversao: number;
  conversao_anterior: number;
  receita_mes: number;
  receita_mes_anterior: number;
  ticket_medio: number;
  cac: number | null;
  receita_recorrente_projetada: number;
  fu_atrasados: number;
  fu_pendentes: number;
  evasao_pct: number;
}

async function computeUnidade(sb: any, unidade_id: string, unidade_nome: string, meta: any): Promise<UnidadeKPIs> {
  const now = new Date();
  const wkStart = mondayOf(now), wkEnd = sundayOf(now);
  const prevStart = mondayOf(subWeeks(now, 1)), prevEnd = sundayOf(subWeeks(now, 1));
  const monthStart = startOfMonth(now), monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subWeeks(now, 4)), prevMonthEnd = endOfMonth(subWeeks(now, 4));

  const alunos_ativos = Number(meta?.alunos_ativos_manual ?? 0);

  const { data: matrSem } = await sb.from('interacoes').select('id')
    .eq('unidade_id', unidade_id).eq('fechou_matricula', true)
    .gte('data_fechamento', fmtDate(wkStart)).lte('data_fechamento', fmtDate(wkEnd));
  const { data: matrAnt } = await sb.from('interacoes').select('id')
    .eq('unidade_id', unidade_id).eq('fechou_matricula', true)
    .gte('data_fechamento', fmtDate(prevStart)).lte('data_fechamento', fmtDate(prevEnd));

  const { data: expSem } = await sb.from('interacoes').select('id, compareceu')
    .eq('unidade_id', unidade_id).eq('agendou_experimental', true)
    .gte('data_experimental', fmtDate(wkStart)).lte('data_experimental', fmtDate(wkEnd));
  const { data: expAnt } = await sb.from('interacoes').select('id, compareceu')
    .eq('unidade_id', unidade_id).eq('agendou_experimental', true)
    .gte('data_experimental', fmtDate(prevStart)).lte('data_experimental', fmtDate(prevEnd));

  const experimentais = (expSem ?? []).length;
  const comparecimentos = (expSem ?? []).filter((e: any) => e.compareceu === true).length;
  const comparecimento = experimentais > 0 ? Math.round((comparecimentos / experimentais) * 100) : 0;
  const expAntTotal = (expAnt ?? []).length;
  const compAnt = (expAnt ?? []).filter((e: any) => e.compareceu === true).length;
  const comparecimento_anterior = expAntTotal > 0 ? Math.round((compAnt / expAntTotal) * 100) : 0;

  const matriculas_semana = (matrSem ?? []).length;
  const matriculas_semana_anterior = (matrAnt ?? []).length;
  const conversao = comparecimentos > 0 ? Math.round((matriculas_semana / comparecimentos) * 100) : 0;
  const conversao_anterior = compAnt > 0 ? Math.round((matriculas_semana_anterior / compAnt) * 100) : 0;

  const { count: fu_pendentes } = await sb.from('follow_ups').select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidade_id).eq('status', 'pendente');
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const { count: fu_atrasados } = await sb.from('follow_ups').select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidade_id).eq('status', 'pendente').lte('data_prevista', fmtDate(yesterday));

  const { data: receitaRows } = await sb.from('interacoes').select('valor_plano')
    .eq('unidade_id', unidade_id).eq('fechou_matricula', true)
    .gte('data_fechamento', fmtDate(monthStart)).lte('data_fechamento', fmtDate(monthEnd));
  const receita_mes = (receitaRows ?? []).reduce((s: number, r: any) => s + Number(r.valor_plano || 0), 0);

  const { data: receitaAntRows } = await sb.from('interacoes').select('valor_plano')
    .eq('unidade_id', unidade_id).eq('fechou_matricula', true)
    .gte('data_fechamento', fmtDate(prevMonthStart)).lte('data_fechamento', fmtDate(prevMonthEnd));
  const receita_mes_anterior = (receitaAntRows ?? []).reduce((s: number, r: any) => s + Number(r.valor_plano || 0), 0);

  const ticket_medio = Number(meta?.ticket_medio_real ?? 0);
  const cac = meta?.cac_manual ? Number(meta.cac_manual) : null;
  const meta_alunos = Number(meta?.meta_alunos_mes ?? 0);
  const pct_meta = meta_alunos > 0 ? Math.round((alunos_ativos / meta_alunos) * 100) : 0;
  const faltam_meta = Math.max(0, meta_alunos - alunos_ativos);

  return {
    unidade_id, unidade_nome,
    alunos_ativos, meta_alunos, pct_meta, faltam_meta,
    matriculas_semana, matriculas_semana_anterior,
    comparecimento, comparecimento_anterior,
    conversao, conversao_anterior,
    receita_mes, receita_mes_anterior,
    ticket_medio, cac,
    receita_recorrente_projetada: alunos_ativos * ticket_medio,
    fu_atrasados: fu_atrasados ?? 0,
    fu_pendentes: fu_pendentes ?? 0,
    evasao_pct: Number(meta?.evasao_pct_manual ?? 0),
  };
}

function focoDoDia(zn: UnidadeKPIs, zs: UnidadeKPIs): string {
  const issues: { peso: number; texto: string }[] = [];
  for (const u of [zn, zs]) {
    const tag = u.unidade_nome.toLowerCase().includes('norte') ? 'Zona Norte' : 'Zona Sul';
    if (u.fu_atrasados >= 5) issues.push({ peso: u.fu_atrasados * 2, texto: `cobrar follow-ups atrasados na ${tag}` });
    else if (u.fu_pendentes >= 10) issues.push({ peso: u.fu_pendentes, texto: `revisar follow-ups pendentes na ${tag}` });
    if (u.matriculas_semana < u.matriculas_semana_anterior) issues.push({ peso: 30 + (u.matriculas_semana_anterior - u.matriculas_semana) * 5, texto: `puxar novas matrículas na ${tag}` });
    if (u.comparecimento < u.comparecimento_anterior) issues.push({ peso: 25 + (u.comparecimento_anterior - u.comparecimento), texto: `recuperar comparecimento na ${tag}` });
    if (u.conversao < u.conversao_anterior) issues.push({ peso: 20 + (u.conversao_anterior - u.conversao), texto: `melhorar conversão EXP→MAT na ${tag}` });
    if (u.receita_mes < u.receita_mes_anterior) issues.push({ peso: 15, texto: `reforçar receita na ${tag}` });
    if (u.evasao_pct > 5) issues.push({ peso: 20 + u.evasao_pct, texto: `conter evasão na ${tag}` });
  }
  if (issues.length === 0) return 'Manter ritmo: indicadores estáveis em ambas as unidades.';
  issues.sort((a, b) => b.peso - a.peso);
  const top = issues.slice(0, 3).map(i => i.texto);
  const cap = top[0].charAt(0).toUpperCase() + top[0].slice(1);
  return cap + (top.length > 1 ? `, ${top.slice(1).join(' e ')}.` : '.');
}

function buildBlocoUnidade(emoji: string, titulo: string, u: UnidadeKPIs): string {
  const cacTxt = u.cac != null ? fmtBRL(u.cac) : '—';
  return `${emoji} *${titulo}*

Alunos ativos: ${u.alunos_ativos}
Meta: ${u.alunos_ativos} / ${u.meta_alunos || '—'}
Realizado: ${u.meta_alunos > 0 ? u.pct_meta + '%' : '—'}
Faltam: ${u.faltam_meta} alunos

Matrículas: ${u.matriculas_semana}
Semana anterior: ${u.matriculas_semana_anterior}
Variação: ${pctVar(u.matriculas_semana, u.matriculas_semana_anterior)}

Comparecimento: ${u.comparecimento}%
Semana anterior: ${u.comparecimento_anterior}%
Variação: ${ppVar(u.comparecimento, u.comparecimento_anterior)}

Conversão EXP → MAT: ${u.conversao}%
Semana anterior: ${u.conversao_anterior}%
Variação: ${ppVar(u.conversao, u.conversao_anterior)}

Receita do mês: ${fmtBRL(u.receita_mes)}
Mês anterior: ${fmtBRL(u.receita_mes_anterior)}
Variação: ${pctVar(u.receita_mes, u.receita_mes_anterior)}

Ticket médio: ${fmtBRL(u.ticket_medio)}
CAC: ${cacTxt}
Receita recorrente projetada: ${fmtBRL(u.receita_recorrente_projetada)}

Follow-ups atrasados: ${u.fu_atrasados}
Pendentes no total: ${u.fu_pendentes}

Evasão: ${u.evasao_pct}%`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authorizeCronOrJwt(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error || 'Unauthorized' }),
      { status: auth.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN       = Deno.env.get('ZAPI_COMERCIAL_TOKEN') ?? Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN= Deno.env.get('ZAPI_COMERCIAL_CLIENT_TOKEN') ?? Deno.env.get('ZAPI_CLIENT_TOKEN') ?? '';

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const dryRun: boolean = body?.dry_run === true;
    const destino: string = (body?.destino || MANU_PHONE_DEFAULT).replace(/\D/g, '');

    if (!dryRun && (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN)) {
      return new Response(JSON.stringify({ error: 'ZAPI comercial not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Carrega unidades + metas
    const { data: unidades } = await sb.from('unidades').select('id, nome').eq('ativo', true).order('nome');
    const { data: metas } = await sb.from('gestao_metas').select('*');
    const metaMap = new Map((metas ?? []).map((m: any) => [m.unidade_id, m]));

    const kpis: UnidadeKPIs[] = await Promise.all(
      (unidades ?? []).map((u: any) => computeUnidade(sb, u.id, u.nome, metaMap.get(u.id) ?? null))
    );

    const zn = kpis.find(k => k.unidade_nome.toLowerCase().includes('norte') || k.unidade_nome.toLowerCase().includes('madalena'));
    const zs = kpis.find(k => k.unidade_nome.toLowerCase().includes('sul') || k.unidade_nome.toLowerCase().includes('viagem'));

    // Se não achou pelos nomes tradicionais, pega os dois primeiros ou todos
    if (!zn || !zs) {
      console.warn('[gestao-operacional-manu] Unidades ZN/ZS não identificadas pelos nomes. Usando fallback.', kpis.map(k => k.unidade_nome));
    }

    const principalZN = zn || kpis[0];
    const principalZS = zs || kpis[1] || kpis[0];

    // Consolidado
    const ativos_total = kpis.reduce((s, k) => s + k.alunos_ativos, 0);
    const meta_total = kpis.reduce((s, k) => s + k.meta_alunos, 0);
    const pct_total = meta_total > 0 ? Math.round((ativos_total / meta_total) * 100) : 0;
    const faltam_total = Math.max(0, meta_total - ativos_total);
    const matr_total = kpis.reduce((s, k) => s + k.matriculas_semana, 0);
    const matr_ant_total = kpis.reduce((s, k) => s + k.matriculas_semana_anterior, 0);
    const fu_atr_total = kpis.reduce((s, k) => s + k.fu_atrasados, 0);
    const fu_pend_total = kpis.reduce((s, k) => s + k.fu_pendentes, 0);

    const { dateBR, horaBR } = brasiliaParts();
    const foco = focoDoDia(principalZN, principalZS);

    let message = `📊 *GESTÃO OPERACIONAL IRON CLUB*
Atualização: ${dateBR} ${horaBR}

🏋️ *CONSOLIDADO*

Alunos ativos: ${ativos_total}
Meta: ${ativos_total} / ${meta_total || '—'}
Realizado: ${meta_total > 0 ? pct_total + '%' : '—'}
Faltam: ${faltam_total} alunos

Matrículas da semana: ${matr_total}
Semana anterior: ${matr_ant_total}
Variação: ${pctVar(matr_total, matr_ant_total)}

Follow-ups atrasados: ${fu_atr_total}
Pendentes no total: ${fu_pend_total}

━━━━━━━━━━━━━━`;

    // Adiciona blocos de todas as unidades
    for (const k of kpis) {
      const emoji = k.unidade_nome.toLowerCase().includes('madalena') || k.unidade_nome.toLowerCase().includes('norte') ? '📍' : '📌';
      message += `\n\n${buildBlocoUnidade(emoji, k.unidade_nome.toUpperCase(), k)}\n\n━━━━━━━━━━━━━━`;
    }

    message += `

✅ *FOCO DO DIA*

${foco}`;

    if (dryRun) {
      return new Response(JSON.stringify({ success: true, dry_run: true, preview: message, destino }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Health-check do chip
    const sr = await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`,
      { headers: { 'Client-Token': ZAPI_CLIENT_TOKEN } });
    const sj = await sr.json().catch(() => ({}));
    if (!sr.ok || sj?.connected !== true) {
      await sb.from('whatsapp_envios_log').insert({
        funcao: 'send-gestao-operacional-manu', sucesso: false,
        motivo_skip: 'zapi_offline', erro_msg: JSON.stringify(sj).slice(0, 500),
        canal: 'comercial', destino, tipo_destino: 'lead',
      });
      return new Response(JSON.stringify({ error: 'Z-API comercial desconectado', zapi: sj }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const resp = await fetch(zapiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone: destino, message }),
    });
    const respBody = await resp.text();
    const ok = resp.ok;

    await sb.from('whatsapp_envios_log').insert({
      funcao: 'send-gestao-operacional-manu',
      canal: 'comercial',
      destino,
      tipo_destino: 'lead',
      sucesso: ok,
      zapi_status_code: resp.status,
      erro_msg: ok ? null : respBody.slice(0, 500),
    });

    return new Response(JSON.stringify({ success: ok, status: resp.status, response: respBody.slice(0, 400) }),
      { status: ok ? 200 : 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[gestao-operacional-manu] erro', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

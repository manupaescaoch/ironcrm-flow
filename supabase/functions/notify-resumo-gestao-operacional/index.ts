import { createClient } from 'npm:@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { sendTelegramMessage } from '../_shared/telegram.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const ZN_ID = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6';
const ZS_ID = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a';
const STB_ID = '00000000-0000-0000-0000-000000000000';
// Destinatário do resumo: telefone do gestor (o envio é feito pelo Telegram).
const DEFAULT_DEST_PHONE = '81996392285';

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
  const totalAtivosAnterior = (metas || []).reduce((acc: number, m: any) => acc + (m.alunos_ativos_semana_anterior || 0), 0);
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
  const matsThisMonth = (allMats || []).filter((m: any) => {
    const d = new Date(m.data_fechamento + 'T12:00:00');
    return d >= monthStart;
  }).length;
  const matsLastMonth = (allMats || []).filter((m: any) => {
    const d = new Date(m.data_fechamento + 'T12:00:00');
    return d >= prevMonthStart && d <= prevMonthEnd;
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
    ativosAnterior: totalAtivosAnterior,
    meta: totalMetaAlunos,
    matsWeek: matsThisWeek,
    matsPrev: matsLastWeek,
    matsMonth: matsThisMonth,
    matsPrevMonth: matsLastMonth,
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

    const zn = await getStats(supabase, ZN_ID);
    const zs = await getStats(supabase, ZS_ID);
    const stb = await getStats(supabase, STB_ID);

    // Exibição no horário de Recife (UTC-3, igual a America/Sao_Paulo).
    // Usa o relógio real do servidor para não aplicar o fuso duas vezes.
    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife' }).replace(',', '');

    const focoDaUnidade = (nome: string, dados: any): string => {
      const focos: string[] = [];
      if (dados.fuAtrasados > 0 || dados.fuTotal > 50) focos.push(`Revisar follow-ups pendentes na ${nome}`);
      if (parseFloat(dados.comp) < 60) focos.push(`Recuperar comparecimento na ${nome}`);
      if (dados.meta > 0 && dados.ativos < dados.meta) focos.push(`Avançar na meta de alunos da ${nome}`);
      return focos.length > 0 ? focos.join(', ') : 'Manter o ritmo de matrículas e follow-ups';
    };

    const montarMensagem = (nome: string, dados: any): string => {
      const vendasMes = dados.matsMonth * dados.ticket;
      const vendasMesAnterior = dados.matsPrevMonth * dados.ticket;
      const recorrenteMesAnterior = dados.ativosAnterior * dados.ticket;

      return `📊 *GESTÃO OPERACIONAL EVO CLUB*
Atualização: ${dataHora}

📍 *${nome}*

Alunos ativos: ${dados.ativos}

Meta: ${dados.meta}

Realizado: ${pct(dados.ativos, dados.meta)}

Faltam: ${Math.max(0, dados.meta - dados.ativos)} alunos

Matrículas: ${dados.matsWeek}

Semana anterior: ${dados.matsPrev}

Variação: ${diffPct(dados.matsWeek, dados.matsPrev)}

Comparecimento: ${dados.comp}

Semana anterior: ${dados.compPrev}

Conversão EXP → MAT: ${dados.conv}

Semana anterior: ${dados.convPrev}

Vendas do mês: ${dados.matsMonth} matrículas × ${fmtBRL(dados.ticket)} = ${fmtBRL(vendasMes)}

Vendas mês anterior: ${fmtBRL(vendasMesAnterior)}

Variação: ${diffPct(vendasMes, vendasMesAnterior)}

Ticket médio: ${fmtBRL(dados.ticket)}

Receita recorrente projetada do mês: ${fmtBRL(dados.recorrente)}

Receita recorrente do mês anterior: ${fmtBRL(recorrenteMesAnterior)}

✅ *FOCO DO DIA*

${focoDaUnidade(nome, dados)}.`;
    };

    const messages = [
      { unidade: 'EVO MADALENA', text: montarMensagem('EVO MADALENA', zn) },
      { unidade: 'EVO BOA VIAGEM', text: montarMensagem('EVO BOA VIAGEM', zs) },
      { unidade: 'EVO SETÚBAL', text: montarMensagem('EVO SETÚBAL', stb) },
    ];


    // Destino no Telegram: chat privado do usuário cujo telefone corresponde ao informado.
    const digitos = String(destPhone).replace(/\D/g, '').slice(-11);

    const { data: perfis } = await supabase
      .from('user_profiles')
      .select('user_id, telefone');

    const perfil = (perfis ?? []).find(
      (p: any) => String(p.telefone ?? '').replace(/\D/g, '').slice(-11) === digitos,
    );

    let chatId: number | null = null;
    if (perfil?.user_id) {
      const { data: tg } = await supabase
        .from('telegram_users')
        .select('telegram_user_id')
        .eq('user_id', perfil.user_id)
        .eq('status', 'conectado')
        .maybeSingle();
      if (tg?.telegram_user_id) chatId = Number(tg.telegram_user_id);
    }

    if (!chatId) {
      return new Response(
        JSON.stringify({ error: 'Destinatário não possui Telegram conectado', phone: destPhone }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results = [];
    for (const message of messages) {
      let resp = await sendTelegramMessage({
        chat_id: chatId,
        text: message.text,
        parse_mode: 'Markdown',
        recipient_type: 'usuario',
        recipient_id: perfil?.user_id ?? null,
        message_type: 'resumo_gestao_operacional',
      }, supabase);

      if (!resp.ok) {
        resp = await sendTelegramMessage({
          chat_id: chatId,
          text: message.text.replace(/\*/g, ''),
          recipient_type: 'usuario',
          recipient_id: perfil?.user_id ?? null,
          message_type: 'resumo_gestao_operacional',
        }, supabase);
      }

      results.push({
        unidade: message.unidade,
        success: resp.ok,
        error: resp.error ?? null,
        message_id: resp.message_id ?? null,
      });
    }

    const success = results.every((result) => result.success);
    return new Response(JSON.stringify({ success, results, messages }), {
      status: success ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});

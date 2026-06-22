import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { generateShiftClosingMessage } from '../_shared/shiftMessages.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const APP_BASE_URL = 'https://ironclub-app.com';

type FormTipo = 'estagiario_lider' | 'coordenador_unidade' | 'coordenador_horario' | 'relatorio_diario';

function normalizePhone(p: string) {
  let n = (p || '').replace(/\D/g, '');
  if (!n) return '';
  if (!n.startsWith('55')) n = '55' + n;
  return n;
}

function brasilia() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const dateStr = `${v.year}-${v.month}-${v.day}`;
  const hour = Number(v.hour);
  const minute = Number(v.minute);
  const dow = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
  return { dateStr, hour, minute, totalMin: hour * 60 + minute, dow };
}

// Mapeia o cargo cadastrado em cronograma_funcionarios para o tipo de formulário.
// Esta é a FONTE DA VERDADE: se o funcionário tem cargo definido, ele decide
// qual formulário receber, independente do título da atividade no cronograma.
function cargoToTipo(cargo: string | null | undefined): FormTipo | null {
  switch ((cargo || '').toLowerCase()) {
    case 'recepcao': return 'relatorio_diario';
    case 'coordenador_unidade': return 'coordenador_unidade';
    case 'treinador': return 'coordenador_horario';
    case 'estagiario_lider': return 'estagiario_lider';
    default: return null;
  }
}

function detectTipo(titulo: string, responsavelNome?: string, cargo?: string | null): FormTipo | null {
  // 0. Cargo cadastrado vence tudo.
  const byCargo = cargoToTipo(cargo);
  if (byCargo) return byCargo;

  const t = (titulo || '').toLowerCase();
  const n = (responsavelNome || '').toLowerCase();

  // 1. Fallback por nome (legado, para quem ainda não tem cargo cadastrado).
  const recepcao = ['aylana rafaeli', 'danúbia medeiros', 'danubia medeiros', 'gaby mota', 'natan'];
  if (recepcao.some(name => n.includes(name))) return 'relatorio_diario';
  const coordenadores = ['marcelo', 'gabi lima'];
  if (coordenadores.some(name => n.includes(name))) return 'coordenador_unidade';
  const treinadores = ['andrey sales', 'bruno', 'gabriel peres', 'beatriz santana', 'fábio', 'fabio', 'lucas alves'];
  if (treinadores.some(name => n.includes(name))) return 'coordenador_horario';
  const estagiarios = ['everton pedro', 'felipe germano', 'alisson orlando', 'geaze nascimento', 'gabriel araujo', 'estela maria'];
  if (estagiarios.some(name => n.includes(name))) return 'estagiario_lider';

  // 2. Fallback por título.
  if (t.includes('relat') && (t.includes('diário') || t.includes('diario') || t.includes('comercial'))) return 'relatorio_diario';
  if (t.includes('estagi') && (t.includes('líder') || t.includes('lider'))) return 'estagiario_lider';
  if (t.includes('coordenador') && t.includes('unidade')) return 'coordenador_unidade';
  if (t.includes('coordenador') && (t.includes('horário') || t.includes('horario'))) return 'coordenador_horario';
  if (t.includes('encerramento') && (t.includes('turno') || t.includes('horário') || t.includes('horario'))) {
    return 'coordenador_horario';
  }

  return null;
}

const TIPO_LABEL: Record<FormTipo, string> = {
  estagiario_lider: 'Encerramento — Estagiário Líder',
  coordenador_unidade: 'Encerramento — Coordenador de Unidade',
  coordenador_horario: 'Encerramento — Coordenador de Horário',
  relatorio_diario: 'Relatório Diário — Comercial',
};

const TIPO_LINK: Record<FormTipo, string> = {
  estagiario_lider: `${APP_BASE_URL}/encerramento-turno`,
  coordenador_unidade: `${APP_BASE_URL}/encerramento-coordenador`,
  coordenador_horario: `${APP_BASE_URL}/encerramento-horario`,
  relatorio_diario: `${APP_BASE_URL}/relatorio-diario-comercial`,
};

function inferTurno(horario: string): string {
  const h = parseInt(horario.split(':')[0], 10);
  if (h < 12) return 'MANHÃ';
  if (h < 18) return 'TARDE';
  return 'NOITE';
}

function unidadeNomeShort(nome: string) {
  // 'Iron Zona Norte' -> 'ZONA NORTE'
  return nome.replace(/^iron\s+/i, '').toUpperCase();
}


async function __zapiStatusCheck() {
  const id = (Deno.env.get('ZAPI_OPERACIONAL_INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID')); const tk = Deno.env.get('ZAPI_TOKEN');
  const ct = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
  if (!id || !tk) return { connected: false, raw: { error: 'sem credenciais' } };
  try {
    const r = await fetch(`https://api.z-api.io/instances/${id}/token/${tk}/status`, { headers: { 'Client-Token': ct } });
    const j = await r.json().catch(() => ({}));
    return { connected: r.ok && j?.connected === true, raw: j };
  } catch (e) { return { connected: false, raw: { error: String(e) } }; }
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
    const ZAPI_INSTANCE_ID = (Deno.env.get('ZAPI_OPERACIONAL_INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID'));
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      return new Response(JSON.stringify({ error: 'ZAPI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // [Z-API health] aborta cedo se o chip estiver offline (idem cronograma)
    {
      const __st = await __zapiStatusCheck();
      if (!__st.connected) {
        try {
          const __sb = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(
            Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          await __sb.from('whatsapp_envios_log').insert({
            funcao: 'send-formulario-lembretes',
            sucesso: false, motivo_skip: 'zapi_offline',
            erro_msg: JSON.stringify(__st.raw).slice(0, 500),
          });
        } catch {}
        console.warn('[zapi] offline — abortando', __st.raw);
        return new Response(JSON.stringify({ error: 'Z-API desconectado', zapi: __st.raw }), {
          status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let body: any = {};
    try { body = await req.json(); } catch { /* */ }
    const dryRun: boolean = !!body?.dryRun;

    const br = brasilia();
    console.log(`[lembretes] ${br.dateStr} ${br.hour}:${String(br.minute).padStart(2,'0')} dow=${br.dow}`);

    // 1. Buscar atividades do dia da semana
    const { data: atividades, error: errA } = await supabase
      .from('cronograma_atividades')
      .select(`
        id, titulo, horario, unidade_id,
        responsavel:cronograma_funcionarios!cronograma_atividades_responsavel_id_fkey(id, nome, telefone, turno, cargo)
      `)
      .eq('ativo', true)
      .eq('dia_semana', br.dow);
    if (errA) throw errA;

    const candidatos = (atividades || []).filter(a => {
      if (!a.horario) return false;
      const tipo = detectTipo(a.titulo, a.responsavel?.nome);
      if (!tipo) return false;
      const [h, m] = a.horario.split(':').map((x: string) => parseInt(x, 10));
      const horarioMin = h * 60 + m;
      const diff = br.totalMin - horarioMin;
      // Janela: 30min .. 4h após horário previsto.
      // A janela deve ser estreita o suficiente para não disparar novamente se o cron rodar várias vezes,
      // mas larga o suficiente para captar o horário (ex: se o cron roda a cada 15min).
      return diff >= 30 && diff <= 45;
    });

    // Ordena por horário ASC para que o Map preserve o ÚLTIMO horário por chave
    // (coordenador de horário cobre várias atividades do turno; espera-se o fim do turno)
    const candidatosOrdenados = [...candidatos].sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
    const candidatosUnicos = Array.from(new Map(
      candidatosOrdenados.map((a) => {
        const tipo = detectTipo(a.titulo, a.responsavel?.nome)!;
        const resp = a.responsavel as any;
        const turno = (resp?.turno && resp.turno !== 'integral' ? resp.turno : inferTurno(a.horario)).toUpperCase();
        // Chave única por dia, unidade, turno e tipo de formulário.
        // Removido o responsavel_id da chave para garantir que apenas UMA pessoa por turno receba,
        // mesmo que haja múltiplos funcionários na mesma atividade.
        const chaveBase = `${br.dateStr}_${a.unidade_id}_${turno}_${tipo}`;
        return [chaveBase, a] as const;
      })
    ).values());

    console.log(`[lembretes] ${candidatos.length} candidato(s) na janela, ${candidatosUnicos.length} após deduplicação`);

    if (candidatosUnicos.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, candidatos: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Mapas auxiliares
    const unidadeIds = [...new Set(candidatosUnicos.map(c => c.unidade_id))];
    const { data: unidades } = await supabase
      .from('unidades').select('id, nome').in('id', unidadeIds);
    const uMap = new Map((unidades || []).map(u => [u.id, u.nome]));

    // 3. Buscar respostas de hoje em cada tabela (uma vez)
    const todayStart = `${br.dateStr}T00:00:00-03:00`;
    const todayEnd = `${br.dateStr}T23:59:59-03:00`;

    const [respEstag, respCoord, respHor, respRel] = await Promise.all([
      supabase.from('encerramento_turno_respostas')
        .select('nome, unidade, turno, created_at')
        .gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('encerramento_coordenador_respostas')
        .select('nome, unidade, turno, created_at')
        .gte('created_at', todayStart).lte('created_at', todayEnd),
      supabase.from('encerramento_horario_respostas')
        .select('nome, unidade, turno, data')
        .eq('data', br.dateStr),
      supabase.from('relatorio_diario_comercial_respostas')
        .select('nome, unidade, data').eq('data', br.dateStr),
    ]);

    const respMap: Record<FormTipo, any[]> = {
      estagiario_lider: respEstag.data || [],
      coordenador_unidade: respCoord.data || [],
      coordenador_horario: respHor.data || [],
      relatorio_diario: respRel.data || [],
    };

    function jaPreenchido(tipo: FormTipo, unidadeShort: string, turno: string): boolean {
      const lista = respMap[tipo];
      const turnoUp = (turno || '').toUpperCase().trim();
      return lista.some((r: any) => {
        const ru = (r.unidade || '').toUpperCase().trim();
        if (ru !== unidadeShort) return false;
        if (tipo === 'coordenador_unidade' || tipo === 'coordenador_horario') {
          const rt = (r.turno || '').toUpperCase().trim();
          if (rt && turnoUp && rt !== turnoUp) return false;
        }
        return true;
      });
    }

    // 4. Buscar lembretes já registrados hoje
    const { data: lembretesHoje } = await supabase
      .from('formulario_lembretes')
      .select('chave, status_lembrete, tentativas, formulario_tipo, unidade_id, turno, responsavel_id, data')
      .eq('data', br.dateStr);
    const lembreteMap = new Map((lembretesHoje || []).map((l: any) => [l.chave, l]));

    const ZAPI_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const results: any[] = [];

    for (const a of candidatosUnicos) {
      const tipo = detectTipo(a.titulo, a.responsavel?.nome)!;
      const resp = a.responsavel as any;
      if (!resp || !resp.telefone) continue;

      const unidadeNome = uMap.get(a.unidade_id) || '';
      const unidadeShort = unidadeNomeShort(unidadeNome);
      const turno = (resp.turno && resp.turno !== 'integral' ? resp.turno : inferTurno(a.horario)).toUpperCase();
      const chave = `${br.dateStr}_${a.unidade_id}_${turno}_${tipo}`;

      const existente = lembreteMap.get(chave) || (lembretesHoje || []).find((l: any) => (
        l.data === br.dateStr &&
        l.unidade_id === a.unidade_id &&
        l.turno === turno &&
        l.formulario_tipo === tipo
      ));
      if (existente && existente.status_lembrete === 'enviado') {
        results.push({ chave, status: 'ignorado_duplicidade' });
        continue;
      }
      if (existente && existente.status_lembrete === 'erro' && (existente.tentativas || 0) >= 2) {
        results.push({ chave, status: 'ignorado_max_tentativas' });
        continue;
      }

      // Verifica preenchimento
      if (jaPreenchido(tipo, unidadeShort, turno)) {
        await supabase.from('formulario_lembretes').upsert({
          chave, data: br.dateStr, unidade_id: a.unidade_id, unidade_nome: unidadeShort,
          turno, atividade_id: a.id, formulario_tipo: tipo, formulario_titulo: TIPO_LABEL[tipo],
          responsavel_id: resp.id, responsavel_nome: resp.nome, responsavel_telefone: resp.telefone,
          horario_previsto: a.horario, horario_lembrete: new Date().toISOString(),
          status_preenchimento: 'preenchido', status_lembrete: 'nao_necessario', tentativas: 0,
        }, { onConflict: 'chave' });
        results.push({ chave, status: 'nao_necessario' });
        continue;
      }

      const link = TIPO_LINK[tipo];
      const message = generateShiftClosingMessage(resp.nome, link);

      if (dryRun) {
        results.push({ chave, status: 'dry_run', telefone: resp.telefone });
        continue;
      }

      let status = 'erro';
      let zapiResult: any = null;
      let erroMsg: string | null = null;
      try {
        const isComercial = tipo === 'relatorio_diario';
        const instance = isComercial ? Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID') : ZAPI_INSTANCE_ID;
        const token = isComercial ? Deno.env.get('ZAPI_COMERCIAL_TOKEN') : ZAPI_TOKEN;
        const clientToken = isComercial ? (Deno.env.get('ZAPI_COMERCIAL_CLIENT_TOKEN') || '') : ZAPI_CLIENT_TOKEN;
        const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;

        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
          body: JSON.stringify({ phone: normalizePhone(resp.telefone), message }),
        });
        zapiResult = await r.json().catch(() => ({}));
        if (r.ok) status = 'enviado';
        else erroMsg = `HTTP ${r.status}: ${JSON.stringify(zapiResult)}`;
      } catch (e: any) {
        erroMsg = e?.message || String(e);
      }

      const tentativas = (existente?.tentativas || 0) + 1;
      await supabase.from('formulario_lembretes').upsert({
        chave, data: br.dateStr, unidade_id: a.unidade_id, unidade_nome: unidadeShort,
        turno, atividade_id: a.id, formulario_tipo: tipo, formulario_titulo: TIPO_LABEL[tipo],
        responsavel_id: resp.id, responsavel_nome: resp.nome, responsavel_telefone: resp.telefone,
        horario_previsto: a.horario, horario_lembrete: new Date().toISOString(),
        status_preenchimento: 'pendente', status_lembrete: status, tentativas,
        erro_zapi: erroMsg, zapi_response: zapiResult,
      }, { onConflict: 'chave' });

      results.push({ chave, status, tentativas });
    }

    return new Response(JSON.stringify({ ok: true, candidatos: candidatos.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[lembretes] erro', e);
    return new Response(JSON.stringify({ error: e?.message || 'erro' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

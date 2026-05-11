import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function detectTipo(titulo: string): FormTipo | null {
  const t = (titulo || '').toLowerCase();
  if (t.includes('estagi')) return 'estagiario_lider';
  if (t.includes('coordenador') && t.includes('unidade')) return 'coordenador_unidade';
  if (t.includes('relat') && t.includes('di')) return 'relatorio_diario';
  if (t.includes('encerramento de turno') || t.includes('encerramento de hor') || (t.includes('coordenador') && t.includes('hor'))) return 'coordenador_horario';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      return new Response(JSON.stringify({ error: 'ZAPI not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        responsavel:cronograma_funcionarios!cronograma_atividades_responsavel_id_fkey(id, nome, telefone, turno)
      `)
      .eq('ativo', true)
      .eq('dia_semana', br.dow);
    if (errA) throw errA;

    const candidatos = (atividades || []).filter(a => {
      if (!a.horario) return false;
      const tipo = detectTipo(a.titulo);
      if (!tipo) return false;
      const [h, m] = a.horario.split(':').map((x: string) => parseInt(x, 10));
      const horarioMin = h * 60 + m;
      const diff = br.totalMin - horarioMin;
      // Janela: 30min .. 4h após horário previsto
      return diff >= 30 && diff <= 240;
    });

    console.log(`[lembretes] ${candidatos.length} candidato(s) na janela`);

    if (candidatos.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, candidatos: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Mapas auxiliares
    const unidadeIds = [...new Set(candidatos.map(c => c.unidade_id))];
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

    function jaPreenchido(tipo: FormTipo, unidadeShort: string, nome: string, turno: string): boolean {
      const lista = respMap[tipo];
      const nomeUp = (nome || '').toUpperCase().trim();
      const turnoUp = (turno || '').toUpperCase().trim();
      return lista.some((r: any) => {
        const ru = (r.unidade || '').toUpperCase().trim();
        if (ru !== unidadeShort) return false;
        const rn = (r.nome || '').toUpperCase().trim();
        // Exige match de nome quando disponível
        if (nomeUp && rn && rn !== nomeUp) return false;
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
      .select('chave, status_lembrete, tentativas')
      .eq('data', br.dateStr);
    const lembreteMap = new Map((lembretesHoje || []).map((l: any) => [l.chave, l]));

    const ZAPI_URL = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const results: any[] = [];

    for (const a of candidatos) {
      const tipo = detectTipo(a.titulo)!;
      const resp = a.responsavel as any;
      if (!resp || !resp.telefone) continue;

      const unidadeNome = uMap.get(a.unidade_id) || '';
      const unidadeShort = unidadeNomeShort(unidadeNome);
      const turno = (resp.turno && resp.turno !== 'integral' ? resp.turno : inferTurno(a.horario)).toUpperCase();
      const chave = `${br.dateStr}_${a.unidade_id}_${turno}_${resp.id}_${a.id}`;

      const existente = lembreteMap.get(chave);
      if (existente && existente.status_lembrete === 'enviado') {
        results.push({ chave, status: 'ignorado_duplicidade' });
        continue;
      }
      if (existente && existente.status_lembrete === 'erro' && (existente.tentativas || 0) >= 2) {
        results.push({ chave, status: 'ignorado_max_tentativas' });
        continue;
      }

      // Verifica preenchimento
      if (jaPreenchido(tipo, unidadeShort, resp.nome, turno)) {
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
      const message =
        `Fala, ${resp.nome}.\n\n` +
        `O formulário obrigatório do seu turno ainda não foi preenchido.\n\n` +
        `📋 *Formulário:* ${TIPO_LABEL[tipo]}\n` +
        `📍 *Unidade:* ${unidadeShort}\n` +
        `🕒 *Turno:* ${turno}\n\n` +
        `Preenche agora, por favor, para mantermos o controle da operação em dia.\n\n` +
        `🔗 ${link}\n\n` +
        `_Esse preenchimento é obrigatório ao final de cada turno._`;

      if (dryRun) {
        results.push({ chave, status: 'dry_run', telefone: resp.telefone });
        continue;
      }

      let status = 'erro';
      let zapiResult: any = null;
      let erroMsg: string | null = null;
      try {
        const r = await fetch(ZAPI_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
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

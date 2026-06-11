// Shared logic for notify-formulario-encerramento and submit-formulario-publico.
// All template rendering, sanitization, idempotency, rate-limit, group resolution
// and Z-API dispatch lives here so the two entrypoints share one trusted path.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const TIPOS_FORMULARIO = [
  'estagiario_lider',
  'coordenador_unidade',
  'coordenador_horario',
  'relatorio_comercial',
] as const;
export type TipoFormulario = typeof TIPOS_FORMULARIO[number];

export const TIPO_TITULO: Record<TipoFormulario, string> = {
  estagiario_lider: 'Encerramento de Turno — Estagiário Líder',
  coordenador_unidade: 'Encerramento — Coordenador de Unidade',
  coordenador_horario: 'Encerramento — Coordenador de Horário',
  relatorio_comercial: 'Relatório Diário — Comercial',
};

const TIPO_TABLE: Record<TipoFormulario, string> = {
  estagiario_lider: 'encerramento_turno_respostas',
  coordenador_unidade: 'encerramento_coordenador_respostas',
  coordenador_horario: 'encerramento_horario_respostas',
  relatorio_comercial: 'relatorio_diario_comercial_respostas',
};

const UNIDADES_PERMITIDAS = new Set(['ZONA NORTE', 'ZONA SUL']);

// Strict-window for public-form requests: row must be fresh.
const PUBLIC_FORM_FRESH_MS = 10 * 60 * 1000; // 10 min

// Rate limit (per tipo+unidade)
const RATE_5MIN = 10;
const RATE_HOUR = 60;

export interface NotifyContext {
  tipo_formulario: TipoFormulario;
  unidade: string;
  unidade_id?: string | null;
  resposta_id?: string | null;
  requested_by?: string | null;
  origem: 'crm_auth' | 'public_form' | 'internal_test';
}

// ---------------------- Sanitization ----------------------

const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;
const SCRIPT_RE = /<script[\s\S]*?<\/script>/gi;
const DANGEROUS_PROTO_RE = /(javascript|data|vbscript):/gi;
const URL_RE = /https?:\/\/\S+/gi;

export function sanitizeText(input: unknown, opts?: { allowUrls?: boolean }): string {
  if (input === null || input === undefined) return '—';
  let s = String(input);
  if (s.length > 1000) s = s.slice(0, 1000) + '…';
  s = s.replace(SCRIPT_RE, '');
  s = s.replace(HTML_TAG_RE, '');
  s = s.replace(DANGEROUS_PROTO_RE, '');
  if (!opts?.allowUrls) {
    s = s.replace(URL_RE, '[link removido]');
  }
  // Trim asterisks and backticks at extremes so caller-injected formatting cannot
  // break the outer template's bold markers.
  s = s.replace(/[\u0000-\u001f]/g, ' ').trim();
  return s || '—';
}

function boolText(b: unknown): string {
  if (b === true) return 'Sim';
  if (b === false) return 'Não';
  return '—';
}

function rating(n: unknown): string {
  if (typeof n === 'number') return `${n}/5`;
  if (typeof n === 'string' && n) return `${n}/5`;
  return '—';
}

// ---------------------- Templates per tipo ----------------------
// Render fixed labeled message body from a canonical row.
// Caller can NEVER inject text into headings/labels.

function emojiForLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('nome')) return '👤';
  if (l.includes('data')) return '📅';
  if (l.includes('unidade')) return '📍';
  if (l.includes('turno')) return '🕘';
  if (l.includes('experimenta')) return '🧪';
  if (l.includes('ocorr')) return '⚠️';
  if (l.includes('padr') || l.includes('protocolo')) return '✅';
  if (l.includes('feedback')) return '💬';
  if (l.includes('clima')) return '🌡️';
  if (l.includes('equipamento')) return '🛠️';
  if (l.includes('suporte')) return '🆘';
  if (l.includes('matr')) return '🎟️';
  if (l.includes('lead')) return '🎯';
  if (l.includes('cancela')) return '❌';
  if (l.includes('renova')) return '🔁';
  if (l.includes('inadimpl')) return '💸';
  if (l.includes('aluno')) return '🎓';
  if (l.includes('treinador') || l.includes('professor')) return '🏋️';
  if (l.includes('limpeza') || l.includes('organiz') || l.includes('infra')) return '🧼';
  if (l.includes('nota')) return '⭐';
  if (l.includes('pend')) return '📌';
  if (l.includes('plano') || l.includes('amanh')) return '🗓️';
  if (l.includes('observ') || l.includes('gestão') || l.includes('gestao')) return '📝';
  if (l.includes('reclama')) return '😠';
  if (l.includes('elogio') || l.includes('destaque')) return '🌟';
  return '▫️';
}

type Item = { label: string; value: string };

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function fmtPct(v: number) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function renderEstagiarioLider(row: Record<string, unknown>): Item[] {
  return [
    { label: 'Nome', value: sanitizeText(row.nome) },
    { label: 'Turno', value: sanitizeText(row.turno) },
    { label: 'Experimentais realizadas', value: String(row.experimentais_realizadas ?? 0) },
    { label: 'Teve ocorrência?', value: row.teve_ocorrencia ? `Sim — ${sanitizeText(row.ocorrencia_descricao)}` : 'Não' },
    { label: 'Manteve o padrão IRON?', value: row.manteve_padrao ? 'Sim' : `Não — ${sanitizeText(row.padrao_observacao)}` },
    { label: 'Recebeu feedback?', value: row.recebeu_feedback ? `Sim — ${sanitizeText(row.feedback_descricao)}` : 'Não' },
    { label: 'Clima da equipe', value: rating(row.clima_equipe) },
    { label: 'Influência do clima', value: sanitizeText(row.clima_influencia) },
    { label: 'Equipamento com problema?', value: row.equipamento_problema ? `Sim — ${sanitizeText(row.equipamento_descricao)}` : 'Não' },
    { label: 'Faria diferente', value: sanitizeText(row.faria_diferente) },
    { label: 'Precisou de suporte?', value: row.precisou_suporte ? `Sim — ${sanitizeText(row.suporte_descricao)}` : 'Não' },
    { label: 'Para a gestão', value: sanitizeText(row.observacao_gestao) },
  ];
}

function renderCoordenadorUnidade(row: Record<string, unknown>): Item[] {
  const items: Item[] = [
    { label: 'Nome', value: sanitizeText(row.nome) },
    { label: 'Turno', value: sanitizeText(row.turno) },
    { label: 'Último turno do dia?', value: boolText(row.ultimo_turno_dia) },
    { label: 'Limpeza geral', value: rating(row.limpeza_geral) },
    { label: 'Equipamentos funcionando', value: rating(row.equipamentos_funcionando) },
    { label: 'Climatização', value: rating(row.climatizacao) },
    { label: 'Organização do espaço', value: rating(row.organizacao_espaco) },
    { label: 'Infraestrutura', value: rating(row.infraestrutura) },
    { label: 'Todos compareceram?', value: boolText(row.todos_compareceram) },
    { label: 'Faltas/atrasos', value: sanitizeText(row.faltas_atrasos) },
    { label: 'Postura no atendimento', value: rating(row.postura_atendimento) },
    { label: 'Proatividade', value: rating(row.proatividade) },
    { label: 'Destaque positivo?', value: row.destaque_positivo ? `Sim — ${sanitizeText(row.destaque_descricao)}` : 'Não' },
    { label: 'Feedback corretivo?', value: row.feedback_corretivo ? `Sim — ${sanitizeText(row.feedback_descricao)}` : 'Não' },
    { label: 'Reclamação de aluno?', value: row.reclamacao_aluno ? `Sim — ${sanitizeText(row.reclamacao_descricao)}` : 'Não' },
    { label: 'Elogio de aluno?', value: row.elogio_aluno ? `Sim — ${sanitizeText(row.elogio_descricao)}` : 'Não' },
    { label: 'Teve ocorrência?', value: row.teve_ocorrencia ? `Sim — ${sanitizeText(row.ocorrencia_descricao)}` : 'Não' },
    { label: 'Manteve padrão IRON?', value: row.padrao_iron ? 'Sim' : `Não — ${sanitizeText(row.fora_padrao_descricao)}` },
    { label: 'Funcionou bem', value: sanitizeText(row.funcionou_bem) },
    { label: 'Nota geral', value: rating(row.nota_geral) },
  ];
  if (row.ultimo_turno_dia) {
    items.push({ label: 'Pontos de atenção', value: sanitizeText(row.pontos_atencao) });
    items.push({ label: 'Pendências abertas', value: sanitizeText(row.pendencias_abertas) });
  }
  return items;
}

function renderCoordenadorHorario(row: Record<string, unknown>): Item[] {
  return [
    { label: 'Nome', value: sanitizeText(row.nome) },
    { label: 'Data', value: sanitizeText(row.data) },
    { label: 'Turno', value: sanitizeText(row.turno) },
    { label: 'Experimentais realizadas', value: String(row.experimentais_realizadas ?? 0) },
    { label: 'Treinador faltou?', value: row.treinador_faltou ? `Sim — ${sanitizeText(row.treinador_faltou_quem)}` : 'Não' },
    { label: 'Atendimentos por treinador', value: sanitizeText(row.atendimentos_por_treinador) },
    { label: 'Sala organizada?', value: row.sala_organizada ? 'Sim' : `Não — ${sanitizeText(row.pendencia_organizacao)}` },
    { label: 'Teve ocorrência?', value: row.teve_ocorrencia ? `Sim — ${sanitizeText(row.ocorrencia_descricao)}` : 'Não' },
    { label: 'Teve feedback de aluno?', value: row.teve_feedback_aluno ? `Sim — ${sanitizeText(row.feedback_aluno_descricao)}` : 'Não' },
    { label: 'Destaque positivo?', value: row.destaque_positivo ? `Sim — ${sanitizeText(row.destaque_descricao)}` : 'Não' },
    { label: 'Feedback corretivo?', value: row.feedback_corretivo ? `Sim — ${sanitizeText(row.feedback_corretivo_descricao)}` : 'Não' },
    { label: 'Nota geral', value: rating(row.nota_geral) },
    { label: 'Observações', value: sanitizeText(row.observacoes) },
  ];
}

function renderRelatorioComercial(row: Record<string, unknown>): Item[] {
  // Extract metadata if available (added by executeNotification)
  const meta = (row._meta as any) || {};

  const inadimplentes = row.inadimplentes_qtd != null
    ? String(row.inadimplentes_qtd)
    : sanitizeText(row.inadimplentes);
  const naoRenovados = row.nao_renovados_qtd != null
    ? String(row.nao_renovados_qtd)
    : sanitizeText(row.nao_renovados);
  const evasaoNum = row.evasao != null
    ? String(row.evasao)
    : (meta.evasao != null ? fmtPct(meta.evasao) : '—');

  return [
    { label: 'Responsável pelo fechamento', value: sanitizeText(row.nome) },
    { label: 'Data', value: sanitizeText(row.data) },
    { label: 'Total de alunos ativos', value: `${row.total_alunos_ativos ?? 0}${meta.meta_alunos ? ` (Meta: ${meta.meta_alunos})` : ''}` },
    { label: 'Leads recebidos', value: String(row.leads_recebidos ?? 0) },
    { label: 'Experimentais realizadas', value: String(row.experimentais_realizadas ?? 0) },
    { label: 'Novas matrículas', value: String(row.novos_alunos ?? 0) },
    { label: 'Renovações realizadas', value: String(row.renovacoes ?? 0) },
    { label: 'Cancelamentos', value: String(row.cancelamentos ?? 0) },
    { label: 'Não renovados', value: naoRenovados },
    { label: 'Evasão', value: evasaoNum },
    { label: 'Inadimplentes', value: inadimplentes },
    { label: 'Receita do mês', value: fmtBRL(meta.receita_mes || 0) },
    { label: 'Ticket médio', value: fmtBRL(meta.ticket_medio || 0) },
    { label: 'Ocorrência fora do comum?', value: row.ocorrencia ? `Sim — ${sanitizeText(row.ocorrencia_descricao)}` : 'Não' },
    { label: 'Feedback negativo de aluno?', value: row.feedback_negativo ? `Sim — ${sanitizeText(row.feedback_negativo_descricao)}` : 'Não' },
    { label: 'Para a liderança', value: sanitizeText(row.observacoes) },
  ];
}

const RENDERERS: Record<TipoFormulario, (row: Record<string, unknown>) => Item[]> = {
  estagiario_lider: renderEstagiarioLider,
  coordenador_unidade: renderCoordenadorUnidade,
  coordenador_horario: renderCoordenadorHorario,
  relatorio_comercial: renderRelatorioComercial,
};

export function buildMessage(tipo: TipoFormulario, unidade: string, row: Record<string, unknown>): string {
  const items = RENDERERS[tipo](row);
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const cabecalho = tipo === 'relatorio_comercial'
    ? `📊 *GESTÃO OPERACIONAL IRON CLUB*`
    : `✅ *${TIPO_TITULO[tipo]}*`;

  const corpo = items
    .filter((it) => it.value && it.value !== '—')
    .map((it) => `${emojiForLabel(it.label)} *${it.label}:* ${it.value}`)
    .join('\n');

  if (tipo === 'relatorio_comercial') {
    return `${cabecalho}\nAtualização: ${dataHora}\n\n📍 *Unidade:* ${sanitizeText(unidade)}\n\n${corpo}`;
  }

  return `${cabecalho}\n\n📍 *Unidade:* ${sanitizeText(unidade)}\n🕒 *Recebido em:* ${dataHora}\n\n${corpo}`;
}

// ---------------------- Helpers ----------------------

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

export function validateUnidade(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  const up = u.toUpperCase().trim();
  return UNIDADES_PERMITIDAS.has(up) ? up : null;
}

export async function sha1Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------------------- Canonical row loader (public flow) ----------------------

export async function loadCanonicalRow(
  supabase: SupabaseClient,
  tipo: TipoFormulario,
  resposta_id: string,
): Promise<{ row: Record<string, unknown> | null; reason?: string }> {
  const table = TIPO_TABLE[tipo];
  const { data, error } = await supabase.from(table).select('*').eq('id', resposta_id).maybeSingle();
  if (error) return { row: null, reason: 'db_error' };
  if (!data) return { row: null, reason: 'not_found' };
  // Freshness check: only recent rows can trigger public notification
  const createdAt = data.created_at ? new Date(data.created_at as string).getTime() : 0;
  if (Date.now() - createdAt > PUBLIC_FORM_FRESH_MS) {
    return { row: null, reason: 'stale' };
  }
  return { row: data as Record<string, unknown> };
}

// ---------------------- Rate limit ----------------------

export async function checkRateLimit(
  supabase: SupabaseClient,
  tipo: TipoFormulario,
  unidade: string,
): Promise<{ ok: boolean; reason?: string }> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count: count5 } = await supabase
    .from('formulario_envios_log')
    .select('id', { count: 'exact', head: true })
    .eq('tipo_formulario', tipo)
    .eq('unidade', unidade)
    .in('status', ['enviado', 'duplicado'])
    .gte('created_at', fiveMinAgo);
  if ((count5 ?? 0) >= RATE_5MIN) return { ok: false, reason: '5min' };

  const { count: countH } = await supabase
    .from('formulario_envios_log')
    .select('id', { count: 'exact', head: true })
    .eq('tipo_formulario', tipo)
    .eq('unidade', unidade)
    .in('status', ['enviado', 'duplicado'])
    .gte('created_at', hourAgo);
  if ((countH ?? 0) >= RATE_HOUR) return { ok: false, reason: 'hour' };

  return { ok: true };
}

// ---------------------- Group resolver ----------------------

export async function resolveGrupo(
  supabase: SupabaseClient,
  tipo: TipoFormulario,
  unidade: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('formulario_grupos_whatsapp')
    .select('grupo_id, ativo')
    .eq('formulario_key', tipo)
    .eq('unidade', unidade)
    .maybeSingle();
  if (!data || !data.ativo || !data.grupo_id) return null;
  return data.grupo_id as string;
}

// ---------------------- Z-API dispatch ----------------------

async function sendZapi(grupoId: string, message: string, tipoFormulario: TipoFormulario): Promise<{ ok: boolean; status: number }> {
  // O Relatório Diário Comercial deve ser enviado pelo número COMERCIAL.
  // Os demais formulários operacionais continuam na instância OPERACIONAL.
  const isComercial = tipoFormulario === 'relatorio_comercial';

  const instance = isComercial
    ? (Deno.env.get('ZAPI_COMERCIAL_INSTANCE_ID'))
    : (Deno.env.get('ZAPI_OPERACIONAL_INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID'));

  const token = isComercial
    ? (Deno.env.get('ZAPI_COMERCIAL_TOKEN'))
    : (Deno.env.get('ZAPI_OPERACIONAL_TOKEN') ?? Deno.env.get('ZAPI_TOKEN'));

  const clientToken = isComercial
    ? (Deno.env.get('ZAPI_COMERCIAL_CLIENT_TOKEN') ?? '')
    : (Deno.env.get('ZAPI_OPERACIONAL_CLIENT_TOKEN') ?? Deno.env.get('ZAPI_CLIENT_TOKEN') ?? '');

  if (!instance || !token) {
    console.error(`[sendZapi] Credenciais ausentes para ${isComercial ? 'COMERCIAL' : 'OPERACIONAL'}`);
    return { ok: false, status: 500 };
  }

  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
    body: JSON.stringify({ phone: grupoId, message }),
  });
  try { await resp.text(); } catch { /* ignore */ }
  return { ok: resp.ok, status: resp.status };
}


// ---------------------- Main orchestration ----------------------

export interface NotifyResult {
  status: number;
  body: Record<string, unknown>;
}

export async function executeNotification(
  ctx: NotifyContext,
  row: Record<string, unknown>,
): Promise<NotifyResult> {
  const supabase = getServiceClient();

  // For commercial report, fetch extra metadata from DB
  if (ctx.tipo_formulario === 'relatorio_comercial' && ctx.unidade_id) {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

      const [metasRes, interacoesRes] = await Promise.all([
        supabase.from('gestao_metas').select('*').eq('unidade_id', ctx.unidade_id).maybeSingle(),
        supabase.from('interacoes')
          .select('valor_plano')
          .eq('unidade_id', ctx.unidade_id)
          .eq('fechou_matricula', true)
          .gte('data_fechamento', monthStart)
          .lte('data_fechamento', monthEnd)
      ]);

      const meta = metasRes.data;
      const interacoes = interacoesRes.data || [];
      const receitaMes = interacoes.reduce((s, i: any) => s + Number(i.valor_plano || 0), 0);

      row._meta = {
        meta_alunos: meta?.meta_alunos_mes,
        receita_mes: receitaMes,
        ticket_medio: meta?.ticket_medio_real,
        evasao: meta?.evasao_pct_manual
      };
    } catch (e) {
      console.error('[executeNotification] Failed to fetch metadata', e);
    }
  }

  // 1. Rate limit
  const rl = await checkRateLimit(supabase, ctx.tipo_formulario, ctx.unidade);
  if (!rl.ok) {
    await supabase.from('formulario_envios_log').insert({
      idempotency_key: `rl_${ctx.tipo_formulario}_${ctx.unidade}_${Date.now()}`,
      tipo_formulario: ctx.tipo_formulario,
      unidade: ctx.unidade,
      unidade_id: ctx.unidade_id ?? null,
      resposta_id: ctx.resposta_id ?? null,
      requested_by: ctx.requested_by ?? null,
      origem: ctx.origem,
      status: 'rate_limited',
      error_message: rl.reason ?? null,
    });
    return { status: 429, body: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' } };
  }

  // 2. Build idempotency key
  const baseKey = ctx.resposta_id
    ? `${ctx.tipo_formulario}|${ctx.unidade}|${ctx.resposta_id}`
    : `${ctx.tipo_formulario}|${ctx.unidade}|${new Date().toISOString().slice(0, 10)}|${await sha1Hex(JSON.stringify(row))}`;
  const idempotency_key = await sha1Hex(baseKey);

  // 3. Idempotency check
  const { data: existing } = await supabase
    .from('formulario_envios_log')
    .select('id, status')
    .eq('idempotency_key', idempotency_key)
    .maybeSingle();
  if (existing && existing.status === 'enviado') {
    return { status: 200, body: { ok: true, sent: false, reason: 'duplicate', idempotent: true } };
  }

  // 4. Resolve group
  const grupoId = await resolveGrupo(supabase, ctx.tipo_formulario, ctx.unidade);
  if (!grupoId) {
    await supabase.from('formulario_envios_log').upsert({
      idempotency_key,
      tipo_formulario: ctx.tipo_formulario,
      unidade: ctx.unidade,
      unidade_id: ctx.unidade_id ?? null,
      resposta_id: ctx.resposta_id ?? null,
      requested_by: ctx.requested_by ?? null,
      origem: ctx.origem,
      status: 'sem_grupo',
    }, { onConflict: 'idempotency_key' });
    return { status: 200, body: { ok: true, sent: false, reason: 'no_group' } };
  }

  // 5. Build message (template server-side)
  const message = buildMessage(ctx.tipo_formulario, ctx.unidade, row);
  const grupoHash = (await sha1Hex(grupoId)).slice(0, 12);
  const payloadHash = (await sha1Hex(message)).slice(0, 16);

  // 6. Send via Z-API
  const send = await sendZapi(grupoId, message, ctx.tipo_formulario);

  // 7. Log
  await supabase.from('formulario_envios_log').upsert({
    idempotency_key,
    tipo_formulario: ctx.tipo_formulario,
    unidade: ctx.unidade,
    unidade_id: ctx.unidade_id ?? null,
    resposta_id: ctx.resposta_id ?? null,
    requested_by: ctx.requested_by ?? null,
    origem: ctx.origem,
    status: send.ok ? 'enviado' : 'erro',
    destino_grupo_hash: grupoHash,
    payload_hash: payloadHash,
    error_message: send.ok ? null : `zapi_status_${send.status}`,
    sent_at: send.ok ? new Date().toISOString() : null,
  }, { onConflict: 'idempotency_key' });

  if (!send.ok) {
    return { status: 502, body: { error: 'Falha ao notificar. Tente novamente.' } };
  }
  return { status: 200, body: { ok: true, sent: true } };
}

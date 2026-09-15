// Shared logic for notify-formulario-encerramento and submit-formulario-publico.
// All template rendering, sanitization, idempotency, rate-limit, group resolution
// and Z-API dispatch lives here so the two entrypoints share one trusted path.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildIdempotencyKey, getZapiCreds, sendTextIdempotent } from './zapi.ts';

export const TIPOS_FORMULARIO = [
  'estagiario_lider',
  'coordenador_unidade',
  'coordenador_horario',
  'relatorio_comercial',
  'coordenador_tecnico',
] as const;
export type TipoFormulario = typeof TIPOS_FORMULARIO[number];

export const TIPO_TITULO: Record<TipoFormulario, string> = {
  estagiario_lider: 'Encerramento de Turno — Estagiário Líder',
  coordenador_unidade: 'Encerramento — Gerente de Unidade',
  coordenador_horario: 'Encerramento — Coordenador de Horário',
  relatorio_comercial: 'Relatório Diário — Comercial',
  coordenador_tecnico: 'Encerramento Técnico Diário | Coordenador Geral',
};

const TIPO_TABLE: Record<TipoFormulario, string> = {
  estagiario_lider: 'encerramento_turno_respostas',
  coordenador_unidade: 'encerramento_coordenador_respostas',
  coordenador_horario: 'encerramento_horario_respostas',
  relatorio_comercial: 'relatorio_diario_comercial_respostas',
  coordenador_tecnico: 'encerramento_tecnico_respostas',
};

const UNIDADES_PERMITIDAS = new Set(['MADALENA', 'BOA VIAGEM', 'SETUBAL']);
const UNIDADE_NORMALIZACAO: Record<string, string> = {
  'ZONA NORTE': 'MADALENA',
  'ZONA SUL': 'BOA VIAGEM',
};

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
    { label: 'Manteve o padrão EVO?', value: row.manteve_padrao ? 'Sim' : `Não — ${sanitizeText(row.padrao_observacao)}` },
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
    { label: 'Manteve padrão EVO?', value: row.padrao_iron ? 'Sim' : `Não — ${sanitizeText(row.fora_padrao_descricao)}` },
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
  const meta = (row._meta as any) || {};

  const fechamentoLabels: Record<string, string> = {
    TODAS: 'Sim, todas',
    PARCIAL: 'Sim, parcial',
    NENHUMA: 'Nenhuma',
    NAO_HOUVE: 'Não houve experimental hoje',
  };
  const motivoLabels: Record<string, string> = {
    PRECO: 'Preço',
    VAI_PENSAR: 'Vai pensar',
    NAO_GOSTOU: 'Não gostou da proposta',
    HORARIO: 'Questão de horário',
    OUTRO: 'Outro',
  };

  const fechamentoKey = row.fechamento_experimentais as string | null;
  const motivoKey = row.motivo_nao_fechamento as string | null;
  const motivoLabel = motivoKey
    ? (motivoKey === 'OUTRO'
        ? `Outro — ${sanitizeText(row.motivo_nao_fechamento_outro)}`
        : (motivoLabels[motivoKey] || motivoKey))
    : '';

  const items: Item[] = [
    { label: 'Responsável pelo relatório', value: sanitizeText(row.nome) },
    { label: 'Data', value: sanitizeText(row.data) },
    { label: 'Total de alunos ativos', value: `${row.total_alunos_ativos ?? 0}${meta.meta_alunos ? ` (Meta: ${meta.meta_alunos})` : ''}` },
    { label: 'Leads recebidos', value: String(row.leads_recebidos ?? 0) },
    { label: 'Experimentais agendadas', value: row.experimentais_agendadas != null ? String(row.experimentais_agendadas) : '' },
    { label: 'Experimentais realizadas', value: String(row.experimentais_realizadas ?? 0) },
    { label: 'Fechamento nas experimentais', value: fechamentoKey ? (fechamentoLabels[fechamentoKey] || fechamentoKey) : '' },
  ];

  if (fechamentoKey === 'PARCIAL' || fechamentoKey === 'NENHUMA') {
    items.push({ label: 'Quantos não fecharam', value: row.qtd_nao_fecharam != null ? String(row.qtd_nao_fecharam) : '' });
    items.push({ label: 'Motivo do não fechamento', value: motivoLabel });
  }

  items.push(
    { label: 'Novas matrículas hoje', value: sanitizeText(row.novas_matriculas_texto) },
    { label: 'Renovações hoje', value: sanitizeText(row.renovacoes_texto) },
    { label: 'Cancelamentos hoje', value: sanitizeText(row.cancelamentos_texto) },
    { label: 'Não renovações hoje', value: sanitizeText(row.nao_renovados_texto) },
    { label: 'Inadimplentes ativos', value: sanitizeText(row.inadimplentes_texto) },
    { label: 'Ocorrência fora do comum?', value: row.ocorrencia ? `Sim — ${sanitizeText(row.ocorrencia_descricao)}` : (row.ocorrencia === false ? 'Não' : '') },
    { label: 'Feedback negativo de aluno?', value: row.feedback_negativo ? `Sim — ${sanitizeText(row.feedback_negativo_descricao)}` : (row.feedback_negativo === false ? 'Não' : '') },
  );

  if (row.feedback_negativo === true) {
    items.push({
      label: 'Ação tomada?',
      value: row.feedback_acao_tomada
        ? `Sim — ${sanitizeText(row.feedback_acao_descricao)}`
        : (row.feedback_acao_tomada === false ? 'Não' : ''),
    });
  }

  items.push({ label: 'Para a liderança', value: sanitizeText(row.observacoes) });

  return items;
}

// ---------------------- Encerramento Técnico Diário ----------------------
// Template completo: NENHUMA linha desaparece, mesmo quando a resposta é
// "Não", "Nenhuma" ou zero. Listas dinâmicas vêm numeradas.

function txt(v: unknown, fallback = 'Não se aplica'): string {
  if (v === null || v === undefined || String(v).trim() === '') return fallback;
  const s = sanitizeText(v);
  return s === '—' ? fallback : s;
}

function num(v: unknown): string {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? String(n) : '0';
}

function simNao(v: unknown): string {
  return v === true ? 'Sim' : v === false ? 'Não' : 'Não informado';
}

function asList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[];
  return [];
}

function dataBR(v: unknown): string {
  const s = typeof v === 'string' ? v : '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : txt(v);
}

function renderTecnicoDiario(unidade: string, row: Record<string, unknown>): string {
  const L: string[] = [];
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  L.push(`✅ *${TIPO_TITULO.coordenador_tecnico}*`);
  L.push('');
  L.push(`📍 *Unidade:* ${sanitizeText(unidade)}`);
  L.push(`👤 *Coordenador:* ${txt(row.coordenador_nome, 'Não informado')}`);
  L.push(`📅 *Data:* ${dataBR(row.data)}`);
  L.push(`🕒 *Enviado em:* ${dataHora}`);
  L.push('');
  L.push(`🔄 *Alinhamento com a manhã:* ${simNao(row.alinhamento_manha)}`);
  L.push(`📝 *Motivo:* ${txt(row.alinhamento_manha_motivo)}`);
  L.push(`🔄 *Alinhamento com a noite:* ${simNao(row.alinhamento_noite)}`);
  L.push(`📝 *Motivo:* ${txt(row.alinhamento_noite_motivo)}`);
  const pontos = Array.isArray(row.pontos_alinhados)
    ? (row.pontos_alinhados as unknown[]).map((p) => sanitizeText(p)).join(', ')
    : '';
  L.push(`📌 *Pontos alinhados:* ${txt(pontos, 'Nenhuma pendência')}`);
  L.push(`📝 *Detalhamento:* ${txt(row.pontos_alinhados_detalhe)}`);
  L.push('');
  L.push(`🔍 *Ronda técnica:* ${txt(row.ronda_tecnica, 'Não informado')}`);
  L.push(`📝 *Motivo:* ${txt(row.ronda_motivo)}`);
  L.push('');
  L.push(`⚠️ *Desvio técnico ou de conduta:* ${simNao(row.teve_desvio)}`);
  const desvios = asList(row.desvios);
  if (desvios.length === 0) {
    L.push(`👤 *Profissional envolvido:* Não se aplica`);
    L.push(`📝 *Desvio identificado:* Não se aplica`);
    L.push(`✅ *Correção aplicada:* Não se aplica`);
    L.push(`📍 *Situação:* Não se aplica`);
    L.push(`👤 *Responsável pelo acompanhamento:* Não se aplica`);
    L.push(`📅 *Prazo:* Não se aplica`);
  } else {
    desvios.forEach((d, i) => {
      L.push(`— *Desvio ${i + 1} de ${desvios.length}*`);
      L.push(`👤 *Profissional envolvido:* ${txt(d.profissional)}`);
      L.push(`📝 *Desvio identificado:* ${txt(d.desvio)}`);
      L.push(`✅ *Correção aplicada:* ${txt(d.correcao)}`);
      L.push(`📍 *Situação:* ${txt(d.situacao)}`);
      L.push(`👤 *Responsável pelo acompanhamento:* ${txt(d.responsavel)}`);
      L.push(`📅 *Prazo:* ${txt(d.prazo)}`);
    });
  }
  L.push('');
  L.push(`💬 *Feedback corretivo aplicado:* ${simNao(row.teve_feedback)}`);
  const feedbacks = asList(row.feedbacks);
  if (feedbacks.length === 0) {
    L.push(`👤 *Profissional:* Não se aplica`);
    L.push(`📝 *Motivo e orientação:* Não se aplica`);
  } else {
    feedbacks.forEach((f, i) => {
      L.push(`— *Feedback ${i + 1} de ${feedbacks.length}*`);
      L.push(`👤 *Profissional:* ${txt(f.profissional)}`);
      L.push(`📝 *Motivo e orientação:* ${txt(f.motivo)}${f.orientacao ? ` — ${txt(f.orientacao)}` : ''}`);
    });
  }
  L.push('');
  L.push(`🌟 *Destaque positivo:* ${simNao(row.teve_destaque)}`);
  const destaques = asList(row.destaques);
  if (destaques.length === 0) {
    L.push(`👤 *Profissional:* Não se aplica`);
    L.push(`📝 *Comportamento observado:* Não se aplica`);
  } else {
    destaques.forEach((d, i) => {
      L.push(`— *Destaque ${i + 1} de ${destaques.length}*`);
      L.push(`👤 *Profissional:* ${txt(d.profissional)}`);
      L.push(`📝 *Comportamento observado:* ${txt(d.comportamento)}`);
    });
  }
  L.push('');
  L.push(`👥 *Escala cumprida integralmente:* ${simNao(row.escala_cumprida)}`);
  const ocs = asList(row.escala_ocorrencias);
  if (ocs.length === 0) {
    L.push(`❌ *Ocorrência na escala:* Nenhuma`);
    L.push(`🔁 *Cobertura:* Não se aplica`);
    L.push(`📊 *Impacto no atendimento:* Não se aplica`);
  } else {
    ocs.forEach((o, i) => {
      L.push(`— *Ocorrência ${i + 1} de ${ocs.length}*`);
      L.push(`❌ *Ocorrência na escala:* ${txt(o.profissional)} — ${txt(o.tipo)}`);
      L.push(`🔁 *Cobertura:* ${o.cobertura === true ? `Sim — ${txt(o.cobertura_responsavel)}` : 'Não'}`);
      L.push(`📊 *Impacto no atendimento:* ${txt(o.impacto)}`);
    });
  }
  L.push('');
  L.push(`⚖️ *Distribuição dos alunos:* ${txt(row.distribuicao_alunos, 'Não informado')}`);
  L.push(`📝 *Problema identificado:* ${txt(row.distribuicao_problema)}`);
  L.push(`✅ *Ajuste realizado:* ${txt(row.distribuicao_ajuste)}`);
  L.push(`🏋️ *Alunos atendidos no turno da tarde:* ${num(row.alunos_atendidos_tarde)}`);
  const trein = asList(row.atendimentos_treinador);
  const treinTxt = trein.length
    ? trein.map((t) => `${txt(t.treinador)}: ${num(t.quantidade)}`).join(' | ')
    : 'Nenhum registro';
  L.push(`📈 *Atendimentos por treinador:* ${treinTxt}`);
  L.push(`🧪 *Experimentais agendadas:* ${num(row.experimentais_agendadas)}`);
  L.push(`✅ *Experimentais realizadas:* ${num(row.experimentais_realizadas)}`);
  L.push(`❌ *Experimentais ausentes:* ${num(row.experimentais_ausentes)}`);
  L.push('');
  L.push(`🙋 *Feedback ou ocorrência com aluno:* ${simNao(row.teve_ocorrencia_aluno)}`);
  const alunos = asList(row.ocorrencias_aluno);
  if (alunos.length === 0) {
    L.push(`📋 *Tipo:* Não se aplica`);
    L.push(`👤 *Aluno:* Não se aplica`);
    L.push(`📝 *Descrição:* Não se aplica`);
    L.push(`🏋️ *Profissional envolvido:* Não se aplica`);
    L.push(`✅ *Medida adotada:* Não se aplica`);
    L.push(`📣 *Gerente comunicado:* Não se aplica`);
  } else {
    alunos.forEach((a, i) => {
      L.push(`— *Registro ${i + 1} de ${alunos.length}*`);
      L.push(`📋 *Tipo:* ${txt(a.tipo)}`);
      L.push(`👤 *Aluno:* ${txt(a.aluno)}`);
      L.push(`📝 *Descrição:* ${txt(a.descricao)}`);
      L.push(`🏋️ *Profissional envolvido:* ${txt(a.profissional)}`);
      L.push(`✅ *Medida adotada:* ${txt(a.medida)}`);
      L.push(`📣 *Gerente comunicado:* ${simNao(a.gerente_comunicado)}`);
    });
  }
  L.push('');
  L.push(`🧼 *Sala organizada e segura:* ${txt(row.sala_organizada, 'Não informado')}`);
  L.push(`📝 *Problema identificado:* ${txt(row.sala_problema)}`);
  L.push(`✅ *Providência adotada:* ${txt(row.sala_providencia)}`);
  L.push(`🛠️ *Problema de estrutura ou equipamento:* ${simNao(row.teve_problema_estrutura)}`);
  L.push(`📝 *Descrição:* ${txt(row.estrutura_problema)}`);
  L.push(`📊 *Impacto na operação:* ${txt(row.estrutura_impacto)}`);
  L.push(`✅ *Providência adotada:* ${txt(row.estrutura_providencia)}`);
  L.push(`📣 *Gerente comunicado:* ${row.teve_problema_estrutura ? simNao(row.estrutura_gerente_comunicado) : 'Não se aplica'}`);
  L.push('');
  L.push(`⏳ *Pendência para o próximo turno ou dia:* ${simNao(row.teve_pendencia)}`);
  const pend = asList(row.pendencias);
  if (pend.length === 0) {
    L.push(`📝 *Pendência:* Nenhuma`);
    L.push(`👤 *Responsável:* Não se aplica`);
    L.push(`📅 *Prazo:* Não se aplica`);
    L.push(`🔎 *Forma de acompanhamento:* Não se aplica`);
  } else {
    pend.forEach((p, i) => {
      L.push(`— *Pendência ${i + 1} de ${pend.length}*`);
      L.push(`📝 *Pendência:* ${txt(p.pendencia)}`);
      L.push(`👤 *Responsável:* ${txt(p.responsavel)}`);
      L.push(`📅 *Prazo:* ${txt(p.prazo)}`);
      L.push(`🔎 *Forma de acompanhamento:* ${txt(p.acompanhamento)}`);
    });
  }
  L.push('');
  L.push(`🎯 *Prioridade técnica do próximo dia:* ${txt(row.prioridade_tecnica, 'Nenhuma')}`);
  L.push(`📝 *Detalhamento:* ${txt(row.prioridade_detalhe)}`);

  return L.join('\n');
}

const RENDERERS: Record<TipoFormulario, (row: Record<string, unknown>) => Item[]> = {
  estagiario_lider: renderEstagiarioLider,
  coordenador_unidade: renderCoordenadorUnidade,
  coordenador_horario: renderCoordenadorHorario,
  relatorio_comercial: renderRelatorioComercial,
  coordenador_tecnico: () => [],
};

export function buildMessage(tipo: TipoFormulario, unidade: string, row: Record<string, unknown>): string {
  if (tipo === 'coordenador_tecnico') return renderTecnicoDiario(unidade, row);
  const items = RENDERERS[tipo](row);
  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const cabecalho = tipo === 'relatorio_comercial'
    ? `📊 *GESTÃO OPERACIONAL EVO CLUB*`
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
  const canonical = UNIDADE_NORMALIZACAO[up] ?? up;
  return UNIDADES_PERMITIDAS.has(canonical) ? canonical : null;
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

// ---------------------- Group resolver (Telegram) ----------------------

/**
 * Cada formulário vai para o grupo da unidade no Telegram, com fallback de tipo.
 */
const PRIORIDADE_GRUPO: Record<TipoFormulario, TelegramGroupType[]> = {
  estagiario_lider: ['coordenadores', 'gerencia'],
  coordenador_unidade: ['gerencia', 'coordenadores'],
  coordenador_horario: ['coordenadores', 'gerencia'],
  relatorio_comercial: ['comercial', 'gerencia'],
  coordenador_tecnico: ['coordenadores', 'gerencia'],
};

export async function resolveGrupo(
  supabase: SupabaseClient,
  tipo: TipoFormulario,
  unidade: string,
  unidadeId?: string | null,
): Promise<TelegramGrupoUnidade | null> {
  const id = unidadeId ?? (await resolveUnidadeId(supabase, unidade));
  return resolveGrupoUnidade(supabase, id, PRIORIDADE_GRUPO[tipo]);
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

  // For commercial report, fetch meta_alunos for the header line
  if (ctx.tipo_formulario === 'relatorio_comercial' && ctx.unidade_id) {
    try {
      const metasRes = await supabase
        .from('gestao_metas')
        .select('meta_alunos_mes')
        .eq('unidade_id', ctx.unidade_id)
        .maybeSingle();

      row._meta = {
        meta_alunos: metasRes.data?.meta_alunos_mes,
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

  // 6. Send via WhatsApp (D-API operacional ou Z-API comercial)
  const send = await sendWhatsapp(supabase, grupoId, message, ctx.tipo_formulario, idempotency_key);

  // 7. Log
  const errMsg = send.ok
    ? null
    : (send.body?.error || send.body?.message || `provider_${send.provider}_status_${send.status}`);
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
    error_message: send.ok ? null : String(errMsg).slice(0, 500),
    sent_at: send.ok ? new Date().toISOString() : null,
  }, { onConflict: 'idempotency_key' });

  if (!send.ok) {
    console.error('[executeNotification] envio falhou', { provider: send.provider, status: send.status, body: send.body });
    return { status: 502, body: { error: 'Falha ao notificar. Tente novamente.' } };
  }
  return { status: 200, body: { ok: true, sent: true } };
}

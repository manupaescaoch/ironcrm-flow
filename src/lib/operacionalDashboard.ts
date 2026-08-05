// Cálculos e regras do Dashboard Operacional EVO
// Todas as funções são puras para permitir teste e reuso.

export type PeriodoPreset = 'hoje' | '7d' | '15d' | '30d' | 'custom';

export const TURNOS = ['MANHÃ', 'TARDE', 'NOITE'] as const;

export type FuncaoOrigem = 'coordenador' | 'horario' | 'turno';

export const FUNCAO_LABEL: Record<FuncaoOrigem, string> = {
  coordenador: 'Coordenador',
  horario: 'Encerramento de Horário',
  turno: 'Encerramento de Turno',
};

/* ---------------------------------- Tipos --------------------------------- */

export interface AtendimentoRow {
  formulario_id: string;
  data: string;
  unidade: string;
  turno: string;
  responsavel: string | null;
  treinador: string | null;
  quantidade: number | null;
  pendente_revisao: boolean;
  origem: string;
}

export interface HorarioRow {
  id: string;
  created_at: string;
  data: string;
  nome: string;
  unidade: string;
  turno: string;
  teve_ocorrencia: boolean | null;
  ocorrencia_descricao: string | null;
  treinador_faltou: boolean | null;
  treinador_faltou_quem: string | null;
  experimentais_realizadas: number | null;
  teve_feedback_aluno: boolean | null;
  feedback_aluno_descricao: string | null;
  destaque_positivo: boolean | null;
  destaque_descricao: string | null;
  feedback_corretivo: boolean | null;
  feedback_corretivo_descricao: string | null;
  sala_organizada: boolean | null;
  pendencia_organizacao: string | null;
  nota_geral: number | null;
  observacoes: string | null;
}

export interface CoordenadorRow {
  id: string;
  created_at: string;
  nome: string;
  unidade: string;
  turno: string;
  limpeza_geral: number | null;
  equipamentos_funcionando: number | null;
  climatizacao: number | null;
  organizacao_espaco: number | null;
  infraestrutura: number | null;
  postura_atendimento: number | null;
  proatividade: number | null;
  nota_geral: number | null;
  todos_compareceram: boolean | null;
  faltas_atrasos: string | null;
  destaque_positivo: boolean | null;
  destaque_descricao: string | null;
  feedback_corretivo: boolean | null;
  feedback_descricao: string | null;
  reclamacao_aluno: boolean | null;
  reclamacao_descricao: string | null;
  reclamacao_resolvida: boolean | null;
  teve_ocorrencia: boolean | null;
  ocorrencia_tipo: string | null;
  ocorrencia_gravidade: string | null;
  ocorrencia_descricao: string | null;
  ocorrencia_resolvida: boolean | null;
  padrao_iron: boolean | null;
  fora_padrao_descricao: string | null;
  pendencias_abertas: string | null;
  pontos_atencao: string | null;
}

export interface TurnoRow {
  id: string;
  created_at: string;
  nome: string;
  unidade: string;
  turno: string;
  experimentais_realizadas: number | null;
  teve_ocorrencia: boolean;
  ocorrencia_descricao: string | null;
  manteve_padrao: boolean;
  padrao_observacao: string | null;
  recebeu_feedback: boolean;
  feedback_descricao: string | null;
  clima_equipe: number | null;
  equipamento_problema: boolean;
  equipamento_descricao: string | null;
  precisou_suporte: boolean;
  suporte_descricao: string | null;
  observacao_gestao: string | null;
}

export interface PendenciaTracking {
  id: string;
  source_tabela: string;
  source_id: string;
  categoria: string;
  responsavel_solucao: string | null;
  prazo: string | null;
  status: string;
  solucao: string | null;
}

export type Gravidade = 'baixa' | 'media' | 'alta';

export interface PendenciaItem {
  key: string;
  source_tabela: string;
  source_id: string;
  unidade: string;
  data: string;
  turno: string | null;
  registrado_por: string | null;
  categoria: string;
  descricao: string;
  gravidade: Gravidade;
  responsavel_solucao: string | null;
  prazo: string | null;
  status: 'pendente' | 'em_andamento' | 'resolvido' | 'vencido';
  solucao: string | null;
  trackingId: string | null;
}

/* -------------------------------- Utilitários ------------------------------ */

export const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Converte data/hora ISO (UTC) para a data local (BRT do navegador). */
export const dateFromTimestamp = (ts: string) => isoDate(new Date(ts));

export const parseISODate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const diffDays = (a: string, b: string) =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86400000);

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = parseISODate(start);
  const last = parseISODate(end);
  while (cur <= last) {
    out.push(isoDate(cur));
    cur = addDays(cur, 1);
  }
  return out;
}

export function presetRange(preset: PeriodoPreset): { start: string; end: string } {
  const hoje = new Date();
  const end = isoDate(hoje);
  const dias = preset === 'hoje' ? 0 : preset === '7d' ? 6 : preset === '15d' ? 14 : 29;
  return { start: isoDate(addDays(hoje, -dias)), end };
}

/** Período anterior equivalente (mesma duração, imediatamente antes). */
export function previousRange(start: string, end: string) {
  const dur = diffDays(start, end) + 1;
  const prevEnd = addDays(parseISODate(start), -1);
  const prevStart = addDays(prevEnd, -(dur - 1));
  return { start: isoDate(prevStart), end: isoDate(prevEnd) };
}

/** Média de notas válidas (1..5). Retorna null quando não há registro. */
export function mediaNotas(values: (number | null | undefined)[]) {
  const valid = values.filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function variacao(atual: number | null, anterior: number | null) {
  if (atual === null || anterior === null || anterior === 0) return null;
  return { diff: atual - anterior, percentual: ((atual - anterior) / anterior) * 100 };
}

export type NotaClasse = 'excelente' | 'adequado' | 'atencao' | 'critico';

export function classificarNota(media: number | null): NotaClasse | null {
  if (media === null) return null;
  if (media >= 4.5) return 'excelente';
  if (media >= 4) return 'adequado';
  if (media >= 3) return 'atencao';
  return 'critico';
}

export const NOTA_CLASSE_LABEL: Record<NotaClasse, string> = {
  excelente: 'Excelente',
  adequado: 'Adequado',
  atencao: 'Atenção',
  critico: 'Crítico',
};

export const NOTA_CLASSE_COLOR: Record<NotaClasse, string> = {
  excelente: 'text-emerald-600',
  adequado: 'text-blue-600',
  atencao: 'text-amber-600',
  critico: 'text-rose-600',
};

/* --------------------------- Distribuição de turno ------------------------- */

export type DistribuicaoClasse = 'equilibrada' | 'atencao' | 'desequilibrada';

export interface DistribuicaoResultado {
  classe: DistribuicaoClasse;
  amplitude: number;
  maior: { treinador: string; quantidade: number } | null;
  menor: { treinador: string; quantidade: number } | null;
  media: number;
  acimaMedia: string[];
  abaixoMedia: string[];
  totalTreinadores: number;
}

export function calcularDistribuicao(rows: AtendimentoRow[]): DistribuicaoResultado | null {
  const porTreinador = new Map<string, number>();
  rows.forEach((r) => {
    if (!r.treinador || !r.quantidade || r.quantidade <= 0) return;
    porTreinador.set(r.treinador, (porTreinador.get(r.treinador) ?? 0) + r.quantidade);
  });
  if (porTreinador.size === 0) return null;
  const entries = [...porTreinador.entries()].sort((a, b) => b[1] - a[1]);
  const valores = entries.map((e) => e[1]);
  const maiorV = Math.max(...valores);
  const menorV = Math.min(...valores);
  const amplitude = maiorV - menorV;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  return {
    classe: amplitude <= 2 ? 'equilibrada' : amplitude === 3 ? 'atencao' : 'desequilibrada',
    amplitude,
    maior: { treinador: entries[0][0], quantidade: entries[0][1] },
    menor: { treinador: entries[entries.length - 1][0], quantidade: entries[entries.length - 1][1] },
    media,
    acimaMedia: entries.filter((e) => e[1] > media).map((e) => e[0]),
    abaixoMedia: entries.filter((e) => e[1] < media).map((e) => e[0]),
    totalTreinadores: entries.length,
  };
}

/**
 * Distribuição sempre segmentada por unidade — nunca misturar treinadores
 * de unidades diferentes num mesmo cálculo/ranking.
 */
export function calcularDistribuicaoPorUnidade(
  rows: AtendimentoRow[],
): Array<DistribuicaoResultado & { unidade: string }> {
  const unidades = [...new Set(rows.filter((r) => (r.quantidade ?? 0) > 0 && r.treinador).map((r) => r.unidade))].sort();
  return unidades
    .map((u) => {
      const res = calcularDistribuicao(rows.filter((r) => r.unidade === u));
      return res ? { ...res, unidade: u } : null;
    })
    .filter(Boolean) as Array<DistribuicaoResultado & { unidade: string }>;
}

export const DISTRIBUICAO_LABEL: Record<DistribuicaoClasse, string> = {
  equilibrada: 'Equilibrada',
  atencao: 'Atenção',
  desequilibrada: 'Desequilibrada',
};

/* ------------------------- Índice Operacional EVO -------------------------- */

export interface IndiceComponente {
  key: string;
  label: string;
  peso: number;
  media: number | null;
  percentual: number | null;
  contribuicao: number | null;
  mediaAnterior: number | null;
}

export const INDICE_PESOS: { key: string; label: string; peso: number }[] = [
  { key: 'limpeza', label: 'Limpeza', peso: 15 },
  { key: 'organizacao', label: 'Organização', peso: 15 },
  { key: 'climatizacao', label: 'Climatização', peso: 10 },
  { key: 'equipamentos', label: 'Equipamentos', peso: 15 },
  { key: 'infraestrutura', label: 'Infraestrutura', peso: 10 },
  { key: 'postura', label: 'Postura no atendimento', peso: 15 },
  { key: 'proatividade', label: 'Proatividade', peso: 10 },
  { key: 'clima', label: 'Clima da equipe', peso: 10 },
];

/**
 * Índice 0-100. Cada nota (1..5) é convertida em percentual (nota/5) e ponderada.
 * Componentes sem registro são excluídos e os pesos são renormalizados.
 */
export function calcularIndice(
  medias: Record<string, number | null>,
  mediasAnteriores: Record<string, number | null> = {},
): { indice: number | null; componentes: IndiceComponente[]; pesoUtilizado: number } {
  const componentes: IndiceComponente[] = INDICE_PESOS.map((p) => {
    const media = medias[p.key] ?? null;
    const percentual = media === null ? null : (media / 5) * 100;
    return {
      ...p,
      media,
      percentual,
      contribuicao: percentual === null ? null : (percentual * p.peso) / 100,
      mediaAnterior: mediasAnteriores[p.key] ?? null,
    };
  });
  const validos = componentes.filter((c) => c.percentual !== null);
  const pesoUtilizado = validos.reduce((a, c) => a + c.peso, 0);
  if (pesoUtilizado === 0) return { indice: null, componentes, pesoUtilizado: 0 };
  const soma = validos.reduce((a, c) => a + (c.percentual as number) * c.peso, 0);
  return { indice: soma / pesoUtilizado, componentes, pesoUtilizado };
}

/* ------------------------------- Pendências ------------------------------- */

export const CATEGORIAS = [
  'Equipamento',
  'Limpeza',
  'Climatização',
  'Infraestrutura',
  'Atendimento',
  'Aluno',
  'Equipe',
  'Falta ou atraso',
  'Formulário não preenchido',
  'Outro',
] as const;

export const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  vencido: 'Vencido',
};

const grav = (g: string | null | undefined): Gravidade => {
  const v = (g ?? '').toUpperCase();
  if (v.includes('ALTA') || v.includes('GRAVE') || v.includes('CRÍT')) return 'alta';
  if (v.includes('BAIXA') || v.includes('LEVE')) return 'baixa';
  return 'media';
};

interface DerivarInput {
  horario: HorarioRow[];
  coordenador: CoordenadorRow[];
  turno: TurnoRow[];
  formulariosFaltantes: { unidade: string; data: string; turno: string }[];
}

/** Deriva a lista de pendências/ocorrências dos formulários enviados. */
export function derivarPendencias({
  horario,
  coordenador,
  turno,
  formulariosFaltantes,
}: DerivarInput): Omit<PendenciaItem, 'status' | 'responsavel_solucao' | 'prazo' | 'solucao' | 'trackingId'>[] {
  const out: Omit<PendenciaItem, 'status' | 'responsavel_solucao' | 'prazo' | 'solucao' | 'trackingId'>[] = [];
  const push = (
    tabela: string,
    id: string,
    unidade: string,
    data: string,
    t: string | null,
    registrado_por: string | null,
    categoria: string,
    descricao: string,
    gravidade: Gravidade,
  ) => {
    out.push({
      key: `${tabela}:${id}:${categoria}`,
      source_tabela: tabela,
      source_id: id,
      unidade,
      data,
      turno: t,
      registrado_por,
      categoria,
      descricao: descricao?.trim() || 'Sem descrição registrada',
      gravidade,
    });
  };

  horario.forEach((r) => {
    if (r.teve_ocorrencia) push('encerramento_horario_respostas', r.id, r.unidade, r.data, r.turno, r.nome, 'Outro', r.ocorrencia_descricao ?? '', 'media');
    if (r.treinador_faltou) push('encerramento_horario_respostas', r.id, r.unidade, r.data, r.turno, r.nome, 'Falta ou atraso', r.treinador_faltou_quem ?? '', 'alta');
    if (r.teve_feedback_aluno) push('encerramento_horario_respostas', r.id, r.unidade, r.data, r.turno, r.nome, 'Aluno', r.feedback_aluno_descricao ?? '', 'media');
    if (r.sala_organizada === false) push('encerramento_horario_respostas', r.id, r.unidade, r.data, r.turno, r.nome, 'Limpeza', r.pendencia_organizacao ?? '', 'media');
    if (r.feedback_corretivo) push('encerramento_horario_respostas', r.id, r.unidade, r.data, r.turno, r.nome, 'Equipe', r.feedback_corretivo_descricao ?? '', 'media');
    if (typeof r.nota_geral === 'number' && r.nota_geral > 0 && r.nota_geral < 4)
      push('encerramento_horario_respostas', r.id, r.unidade, r.data, r.turno, r.nome, 'Atendimento', `Nota geral do turno ${r.nota_geral}/5`, 'alta');
  });

  coordenador.forEach((r) => {
    const data = dateFromTimestamp(r.created_at);
    const base = (categoria: string, descricao: string, g: Gravidade) =>
      push('encerramento_coordenador_respostas', r.id, r.unidade, data, r.turno, r.nome, categoria, descricao, g);
    if (r.teve_ocorrencia && !r.ocorrencia_resolvida)
      base(r.ocorrencia_tipo?.trim() || 'Outro', r.ocorrencia_descricao ?? '', grav(r.ocorrencia_gravidade));
    if (r.reclamacao_aluno && !r.reclamacao_resolvida) base('Aluno', r.reclamacao_descricao ?? '', 'alta');
    if (r.todos_compareceram === false) base('Falta ou atraso', r.faltas_atrasos ?? '', 'alta');
    if (r.feedback_corretivo) base('Equipe', r.feedback_descricao ?? '', 'media');
    if (r.padrao_iron === false) base('Outro', `Padrão EVO não mantido: ${r.fora_padrao_descricao ?? '—'}`, 'alta');
    const notas: [string, number | null][] = [
      ['Limpeza', r.limpeza_geral],
      ['Climatização', r.climatizacao],
      ['Equipamento', r.equipamentos_funcionando],
      ['Infraestrutura', r.infraestrutura],
      ['Atendimento', r.postura_atendimento],
    ];
    notas.forEach(([cat, nota]) => {
      if (typeof nota === 'number' && nota >= 1 && nota < 4) base(cat, `${cat} avaliada em ${nota}/5`, nota < 3 ? 'alta' : 'media');
    });
    if (r.pendencias_abertas && r.pendencias_abertas.trim()) base('Outro', r.pendencias_abertas, 'media');
  });

  turno.forEach((r) => {
    const data = dateFromTimestamp(r.created_at);
    const base = (categoria: string, descricao: string, g: Gravidade) =>
      push('encerramento_turno_respostas', r.id, r.unidade, data, r.turno, r.nome, categoria, descricao, g);
    if (r.equipamento_problema) base('Equipamento', r.equipamento_descricao ?? '', 'alta');
    if (r.teve_ocorrencia) base('Outro', r.ocorrencia_descricao ?? '', 'media');
    if (!r.manteve_padrao) base('Equipe', `Padrão EVO não mantido: ${r.padrao_observacao ?? '—'}`, 'alta');
    if (r.precisou_suporte) base('Equipe', `Suporte solicitado: ${r.suporte_descricao ?? '—'}`, 'media');
  });

  formulariosFaltantes.forEach((f) => {
    push(
      'formulario_previsto',
      `${f.unidade}|${f.data}|${f.turno}`.replace(/\s/g, '_') as string,
      f.unidade,
      f.data,
      f.turno,
      null,
      'Formulário não preenchido',
      `Encerramento do turno ${f.turno} não foi preenchido`,
      'alta',
    );
  });

  return out;
}

/** Aplica o rastreamento (status/responsável/prazo) salvo no banco. */
export function mesclarTracking(
  derivadas: ReturnType<typeof derivarPendencias>,
  tracking: PendenciaTracking[],
  hoje: string,
): PendenciaItem[] {
  const map = new Map(tracking.map((t) => [`${t.source_tabela}:${t.source_id}:${t.categoria}`, t]));
  return derivadas.map((d) => {
    const t = map.get(d.key);
    let status = (t?.status ?? 'pendente') as PendenciaItem['status'];
    if (status !== 'resolvido' && t?.prazo && t.prazo < hoje) status = 'vencido';
    return {
      ...d,
      status,
      responsavel_solucao: t?.responsavel_solucao ?? null,
      prazo: t?.prazo ?? null,
      solucao: t?.solucao ?? null,
      trackingId: t?.id ?? null,
    };
  });
}

export const GRAVIDADE_LABEL: Record<Gravidade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

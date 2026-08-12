/**
 * EVO | Forecast de Alunos — cálculos puros (sem acesso a dados).
 * Percentuais sempre em decimal internamente (70,2% = 0,702).
 */

export interface Premissas {
  investimento: number;
  cpl: number;
  leadExp: number; // decimal
  comparecimento: number; // decimal
  expMat: number; // decimal
  evasao: number; // decimal
  mensalidade: number;
  baseInicial: number;
  capacidade: number;
  metaAlunos: number;
  aproveitamentoAtendimento: number; // decimal (conversas -> leads)
}

export interface RealMes {
  ano: number;
  mes: number;
  investimento: number;
  conversas: number;
  leads: number;
  experimentais: number;
  comparecimentos: number;
  matriculas: number;
  matriculasTrafego: number;
  ticketMedio: number;
  alunosAtivos: number;
  baseInicial: number;
  cancelamentos: number;
  evasaoPct: number; // decimal
  fechado: boolean;
}

export const MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export const MESES_LONGO = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Divisão segura: nunca NaN, nunca Infinity. */
export function safeDiv(a: number, b: number): number {
  const na = Number(a) || 0;
  const nb = Number(b) || 0;
  if (nb === 0) return 0;
  const r = na / nb;
  return Number.isFinite(r) ? r : 0;
}

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Pessoas: inteiro, nunca negativo. */
export const pessoas = (v: number): number => Math.max(0, Math.round(num(v)));

export const fmtInt = (v: number): string =>
  pessoas(v).toLocaleString('pt-BR');

export const fmtMoeda = (v: number): string =>
  num(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtMoeda0 = (v: number): string =>
  num(v).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

/** Percentual (recebe decimal) com uma casa. */
export const fmtPct = (dec: number): string =>
  `${(num(dec) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const fmtMesAno = (mes: number, ano: number): string =>
  `${MESES[Math.max(0, Math.min(11, mes - 1))]}/${String(ano).slice(-2)}`;

export function proximoMes(mes: number, ano: number): { mes: number; ano: number } {
  return mes === 12 ? { mes: 1, ano: ano + 1 } : { mes: mes + 1, ano };
}

export function mesAnterior(mes: number, ano: number): { mes: number; ano: number } {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}

// ---------------------------------------------------------------- eficiência

export interface EficienciaFunil {
  custoPorConversa: number;
  aproveitamentoAtendimento: number; // decimal
  cpl: number;
  leadExp: number; // decimal
  comparecimento: number; // decimal
  expMat: number; // decimal
  cacTrafego: number;
  evasoes: number;
  evasaoPct: number; // decimal
  crescimentoLiquido: number;
}

export function calcEficiencia(real: RealMes): EficienciaFunil {
  const evasoes = Math.min(pessoas(real.cancelamentos), pessoas(real.baseInicial || real.alunosAtivos));
  return {
    custoPorConversa: safeDiv(real.investimento, real.conversas),
    aproveitamentoAtendimento: safeDiv(real.leads, real.conversas),
    cpl: safeDiv(real.investimento, real.leads),
    leadExp: safeDiv(real.experimentais, real.leads),
    comparecimento: safeDiv(real.comparecimentos, real.experimentais),
    // conversão usa COMPARECIMENTOS como denominador
    expMat: safeDiv(real.matriculas, real.comparecimentos),
    cacTrafego: safeDiv(real.investimento, real.matriculasTrafego),
    evasoes,
    evasaoPct: real.evasaoPct || safeDiv(evasoes, real.baseInicial || real.alunosAtivos),
    crescimentoLiquido: pessoas(real.matriculas) - evasoes,
  };
}

// ------------------------------------------------------------ forecast do mês

export interface ForecastMes {
  leads: number;
  experimentais: number;
  comparecimentos: number;
  matriculas: number;
  evasoes: number;
  crescimentoLiquido: number;
  alunosAtivos: number;
  cac: number;
  receita: number;
  distanciaMeta: number; // positivo = falta; negativo = superou
  ocupacao: number; // decimal
  excedeCapacidade: boolean;
}

export function calcForecastMes(p: Premissas, baseInicial = p.baseInicial): ForecastMes {
  const leads = safeDiv(p.investimento, p.cpl);
  const experimentais = leads * p.leadExp;
  const comparecimentos = experimentais * p.comparecimento;
  const matriculas = comparecimentos * p.expMat;
  const base = pessoas(baseInicial);
  const evasoes = Math.min(base, base * p.evasao);
  const crescimentoLiquido = pessoas(matriculas) - pessoas(evasoes);
  const alunosAtivos = Math.max(0, base + crescimentoLiquido);
  return {
    leads: pessoas(leads),
    experimentais: pessoas(experimentais),
    comparecimentos: pessoas(comparecimentos),
    matriculas: pessoas(matriculas),
    evasoes: pessoas(evasoes),
    crescimentoLiquido,
    alunosAtivos,
    cac: safeDiv(p.investimento, pessoas(matriculas)),
    receita: alunosAtivos * num(p.mensalidade),
    distanciaMeta: pessoas(p.metaAlunos) - alunosAtivos,
    ocupacao: safeDiv(alunosAtivos, p.capacidade),
    excedeCapacidade: p.capacidade > 0 && alunosAtivos > p.capacidade,
  };
}

// ------------------------------------------------------------ projeção 12m

export interface LinhaProjecao extends ForecastMes {
  mes: number;
  ano: number;
  label: string;
  baseInicial: number;
}

export function calcProjecao12(
  p: Premissas,
  mesRef: number,
  anoRef: number,
  meses = 12,
): LinhaProjecao[] {
  const linhas: LinhaProjecao[] = [];
  let base = pessoas(p.baseInicial);
  let cursor = proximoMes(mesRef, anoRef);
  for (let i = 0; i < meses; i++) {
    const f = calcForecastMes(p, base);
    linhas.push({
      ...f,
      mes: cursor.mes,
      ano: cursor.ano,
      label: fmtMesAno(cursor.mes, cursor.ano),
      baseInicial: base,
    });
    // a base final vira a base inicial do mês seguinte
    base = f.alunosAtivos;
    cursor = proximoMes(cursor.mes, cursor.ano);
  }
  return linhas;
}

export interface TotaisProjecao {
  matriculas: number;
  evasoes: number;
  crescimentoLiquido: number;
  receita: number;
}

export function calcTotais(linhas: LinhaProjecao[]): TotaisProjecao {
  return linhas.reduce<TotaisProjecao>(
    (acc, l) => ({
      matriculas: acc.matriculas + l.matriculas,
      evasoes: acc.evasoes + l.evasoes,
      crescimentoLiquido: acc.crescimentoLiquido + l.crescimentoLiquido,
      receita: acc.receita + l.receita,
    }),
    { matriculas: 0, evasoes: 0, crescimentoLiquido: 0, receita: 0 },
  );
}

/** Primeiro mês em que a base projetada atinge um patamar. */
export function primeiroMesAtingindo(linhas: LinhaProjecao[], alvo: number): LinhaProjecao | null {
  if (!alvo || alvo <= 0) return null;
  return linhas.find((l) => l.alunosAtivos >= alvo) ?? null;
}

// --------------------------------------------------------------- meta reversa

export interface MetaReversa {
  meses: number;
  crescimentoNecessarioTotal: number;
  crescimentoNecessario: number; // por mês
  matriculas: number;
  comparecimentos: number;
  experimentais: number;
  leads: number;
  conversas: number;
  investimento: number;
  investimentoAdicional: number;
}

export function calcMetaReversa(
  p: Premissas,
  metaAlunos: number,
  prazoMeses: number,
): MetaReversa {
  const meses = Math.max(1, Math.round(num(prazoMeses)));
  const totalNecessario = Math.max(0, pessoas(metaAlunos) - pessoas(p.baseInicial));
  const crescimentoMes = safeDiv(totalNecessario, meses);
  const evasoesProjetadas = pessoas(p.baseInicial) * p.evasao;
  const matriculas = crescimentoMes + evasoesProjetadas;
  const comparecimentos = safeDiv(matriculas, p.expMat);
  const experimentais = safeDiv(comparecimentos, p.comparecimento);
  const leads = safeDiv(experimentais, p.leadExp);
  const conversas = safeDiv(leads, p.aproveitamentoAtendimento);
  const investimento = leads * num(p.cpl);
  return {
    meses,
    crescimentoNecessarioTotal: pessoas(totalNecessario),
    crescimentoNecessario: pessoas(crescimentoMes),
    matriculas: pessoas(matriculas),
    comparecimentos: pessoas(comparecimentos),
    experimentais: pessoas(experimentais),
    leads: pessoas(leads),
    conversas: pessoas(conversas),
    investimento,
    investimentoAdicional: investimento - num(p.investimento),
  };
}

// ------------------------------------------------------------------ cenários

export interface CenarioInput {
  nome: string;
  metaAlunos: number;
  prazo: number;
  cpl: number;
  leadExp: number;
  comparecimento: number;
  expMat: number;
  evasao: number;
}

export interface CenarioResultado extends CenarioInput {
  matriculasMes: number;
  leadsMes: number;
  investimentoMes: number;
  cac: number;
  receitaNaMeta: number;
}

export function calcCenario(p: Premissas, c: CenarioInput): CenarioResultado {
  const premissas: Premissas = {
    ...p,
    cpl: c.cpl,
    leadExp: c.leadExp,
    comparecimento: c.comparecimento,
    expMat: c.expMat,
    evasao: c.evasao,
  };
  const r = calcMetaReversa(premissas, c.metaAlunos, c.prazo);
  return {
    ...c,
    matriculasMes: r.matriculas,
    leadsMes: r.leads,
    investimentoMes: r.investimento,
    cac: safeDiv(r.investimento, r.matriculas),
    receitaNaMeta: pessoas(c.metaAlunos) * num(p.mensalidade),
  };
}

// ---------------------------------------------------------------- alavancas

export interface Alavanca {
  id: string;
  label: string;
  matriculasAdicionais: number;
  crescimentoAdicional: number;
  alunosAdicionais12m: number;
  receitaAdicional12m: number;
}

const ALAVANCAS: { id: string; label: string; aplicar: (p: Premissas) => Premissas }[] = [
  { id: 'inv', label: '+10% de investimento', aplicar: (p) => ({ ...p, investimento: p.investimento * 1.1 }) },
  { id: 'cpl', label: '-10% no CPL', aplicar: (p) => ({ ...p, cpl: p.cpl * 0.9 }) },
  { id: 'leadexp', label: '+10 p.p. em Lead → Experimental', aplicar: (p) => ({ ...p, leadExp: Math.min(1, p.leadExp + 0.1) }) },
  { id: 'comp', label: '+10 p.p. em comparecimento', aplicar: (p) => ({ ...p, comparecimento: Math.min(1, p.comparecimento + 0.1) }) },
  { id: 'conv', label: '+5 p.p. em conversão', aplicar: (p) => ({ ...p, expMat: Math.min(1, p.expMat + 0.05) }) },
  { id: 'evasao', label: '-1 p.p. de evasão', aplicar: (p) => ({ ...p, evasao: Math.max(0, p.evasao - 0.01) }) },
];

export function calcAlavancas(p: Premissas, mesRef: number, anoRef: number): Alavanca[] {
  const baseMes = calcForecastMes(p);
  const baseProj = calcProjecao12(p, mesRef, anoRef);
  const baseFinal = baseProj[baseProj.length - 1]?.alunosAtivos ?? p.baseInicial;
  const baseReceita = calcTotais(baseProj).receita;

  return ALAVANCAS.map(({ id, label, aplicar }) => {
    const np = aplicar(p);
    const nm = calcForecastMes(np);
    const proj = calcProjecao12(np, mesRef, anoRef);
    const final = proj[proj.length - 1]?.alunosAtivos ?? np.baseInicial;
    return {
      id,
      label,
      matriculasAdicionais: nm.matriculas - baseMes.matriculas,
      crescimentoAdicional: nm.crescimentoLiquido - baseMes.crescimentoLiquido,
      alunosAdicionais12m: final - baseFinal,
      receitaAdicional12m: calcTotais(proj).receita - baseReceita,
    };
  }).sort((a, b) => b.alunosAdicionais12m - a.alunosAdicionais12m);
}

// ------------------------------------------------------------------ semanal

export interface SemanaRow {
  semanaInicio: string; // yyyy-mm-dd (segunda)
  label: string;
  alunosSegunda: number;
  matriculas: number;
  cancelamentos: number;
  alunosSexta: number;
  crescimentoLiquido: number;
  taxaSemana: number; // decimal
  mediaMovel4: number | null; // decimal
  equivalenteMensal: number | null; // decimal
  situacao: 'dentro' | 'atencao' | 'acima' | 'vazio';
  preenchida: boolean;
}

/** Segunda-feira da semana de uma data. */
export function segundaDaSemana(d: Date): Date {
  const dia = d.getDay(); // 0 dom
  const delta = dia === 0 ? -6 : 1 - dia;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dd}`;
}

export function parseISODate(s: string): Date {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

export function classificaSituacao(
  valorMensal: number | null,
  metaEvasaoMensal: number,
): SemanaRow['situacao'] {
  if (valorMensal === null) return 'vazio';
  if (valorMensal <= metaEvasaoMensal) return 'dentro';
  if (valorMensal <= metaEvasaoMensal * 1.25) return 'atencao';
  return 'acima';
}

export interface SemanaInput {
  semana_inicio: string;
  alunos_segunda: number;
  matriculas: number;
  cancelamentos: number;
  alunos_sexta: number | null;
}

/** Monta as N semanas comerciais (seg→sex) mais recentes, mesclando lançamentos. */
export function montaSemanas(
  registros: SemanaInput[],
  metaEvasaoMensal: number,
  hoje = new Date(),
  totalSemanas = 13,
): SemanaRow[] {
  const mapa = new Map(registros.map((r) => [r.semana_inicio, r]));
  const segundaAtual = segundaDaSemana(hoje);
  const semanas: SemanaRow[] = [];

  for (let i = totalSemanas - 1; i >= 0; i--) {
    const seg = new Date(
      segundaAtual.getFullYear(),
      segundaAtual.getMonth(),
      segundaAtual.getDate() - i * 7,
    );
    const sex = new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + 4);
    const iso = toISODate(seg);
    const r = mapa.get(iso);
    const alunosSegunda = pessoas(r?.alunos_segunda ?? 0);
    const matriculas = pessoas(r?.matriculas ?? 0);
    const cancelamentos = Math.min(alunosSegunda || Infinity, pessoas(r?.cancelamentos ?? 0));
    const alunosSexta =
      r?.alunos_sexta != null
        ? pessoas(r.alunos_sexta)
        : Math.max(0, alunosSegunda + matriculas - cancelamentos);
    const preenchida = !!r && alunosSegunda > 0;
    semanas.push({
      semanaInicio: iso,
      label: `${String(seg.getDate()).padStart(2, '0')}/${String(seg.getMonth() + 1).padStart(2, '0')} a ${String(sex.getDate()).padStart(2, '0')}/${String(sex.getMonth() + 1).padStart(2, '0')}`,
      alunosSegunda,
      matriculas,
      cancelamentos,
      alunosSexta,
      crescimentoLiquido: matriculas - cancelamentos,
      taxaSemana: preenchida ? safeDiv(cancelamentos, alunosSegunda) : 0,
      mediaMovel4: null,
      equivalenteMensal: null,
      situacao: 'vazio',
      preenchida,
    });
  }

  // média móvel das últimas 4 semanas fechadas anteriores (inclusive a atual fechada)
  semanas.forEach((s, idx) => {
    if (!s.preenchida) return;
    const janela = semanas.slice(Math.max(0, idx - 3), idx + 1).filter((x) => x.preenchida);
    if (janela.length < 1) return;
    const media = janela.reduce((a, x) => a + x.taxaSemana, 0) / janela.length;
    s.mediaMovel4 = media;
    // 4,33 semanas por mês; composição simples
    s.equivalenteMensal = 1 - Math.pow(1 - media, 4.33);
    s.situacao = classificaSituacao(s.equivalenteMensal, metaEvasaoMensal);
  });

  return semanas;
}

// ------------------------------------------------------------------ insights

export interface Insight {
  tipo: 'Crescimento' | 'Evasão' | 'Funil' | 'Tráfego' | 'Capacidade';
  texto: string;
  tom: 'neutro' | 'bom' | 'atencao' | 'ruim';
}

export function calcInsights(
  p: Premissas,
  ef: EficienciaFunil,
  linhas: LinhaProjecao[],
  mr: MetaReversa,
): Insight[] {
  const out: Insight[] = [];
  const mesMeta = primeiroMesAtingindo(linhas, p.metaAlunos);
  const fmtLongo = (l: LinhaProjecao) => `${MESES_LONGO[l.mes - 1]} de ${l.ano}`;

  if (p.metaAlunos > 0) {
    out.push({
      tipo: 'Crescimento',
      texto: mesMeta
        ? `Mantendo o desempenho atual, a unidade deve alcançar ${fmtInt(p.metaAlunos)} alunos em ${fmtLongo(mesMeta)}.`
        : `Mantendo o desempenho atual, a meta de ${fmtInt(p.metaAlunos)} alunos não é alcançada nos próximos ${linhas.length} meses.`,
      tom: mesMeta ? 'bom' : 'ruim',
    });
  }

  const fMes = calcForecastMes(p);
  if (fMes.matriculas > 0) {
    const consumo = safeDiv(fMes.evasoes, fMes.matriculas);
    out.push({
      tipo: 'Evasão',
      texto: `A evasão projetada está consumindo ${fmtPct(consumo)} das novas matrículas do mês.`,
      tom: consumo > 0.7 ? 'ruim' : consumo > 0.4 ? 'atencao' : 'bom',
    });
  }

  const etapas: { nome: string; taxa: number }[] = [
    { nome: 'conversa iniciada e lead cadastrado', taxa: ef.aproveitamentoAtendimento },
    { nome: 'lead e experimental marcado', taxa: ef.leadExp },
    { nome: 'experimental marcado e comparecimento', taxa: ef.comparecimento },
    { nome: 'comparecimento e matrícula', taxa: ef.expMat },
  ].filter((e) => e.taxa > 0);
  if (etapas.length) {
    const pior = etapas.reduce((a, b) => (b.taxa < a.taxa ? b : a));
    out.push({
      tipo: 'Funil',
      texto: `O maior gargalo do funil está entre ${pior.nome} (${fmtPct(pior.taxa)}).`,
      tom: 'atencao',
    });
  }

  if (mr.investimento > 0) {
    out.push({
      tipo: 'Tráfego',
      texto: `Mantendo o CPL atual, seriam necessários aproximadamente ${fmtMoeda0(mr.investimento)}/mês em tráfego para atingir a meta estabelecida.`,
      tom: mr.investimentoAdicional > 0 ? 'atencao' : 'bom',
    });
  }

  if (p.capacidade > 0) {
    const alvo80 = p.capacidade * 0.8;
    const mes80 = primeiroMesAtingindo(linhas, alvo80);
    const idx = mes80 ? linhas.indexOf(mes80) + 1 : null;
    out.push({
      tipo: 'Capacidade',
      texto: idx
        ? `A unidade deve atingir 80% da capacidade em aproximadamente ${idx} ${idx === 1 ? 'mês' : 'meses'}.`
        : `A unidade permanece abaixo de 80% da capacidade (${fmtInt(p.capacidade)} alunos) nos próximos ${linhas.length} meses.`,
      tom: 'neutro',
    });
  }

  return out.slice(0, 5);
}

// ------------------------------------------------------------------- status

export type StatusSinal = 'bom' | 'atencao' | 'ruim' | 'neutro';

/** Compara valor com meta. `maiorMelhor` define a direção. */
export function sinal(valor: number, meta: number, maiorMelhor = true): StatusSinal {
  if (!meta || !Number.isFinite(meta) || meta === 0) return 'neutro';
  const r = safeDiv(valor, meta);
  if (maiorMelhor) {
    if (r >= 1) return 'bom';
    if (r >= 0.85) return 'atencao';
    return 'ruim';
  }
  if (r <= 1) return 'bom';
  if (r <= 1.15) return 'atencao';
  return 'ruim';
}

export const CLASSES_SINAL: Record<StatusSinal, string> = {
  bom: 'text-emerald-600 dark:text-emerald-400',
  atencao: 'text-amber-600 dark:text-amber-400',
  ruim: 'text-red-600 dark:text-red-400',
  neutro: 'text-foreground',
};

export const BADGE_SINAL: Record<StatusSinal, string> = {
  bom: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  atencao: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  ruim: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  neutro: 'bg-muted text-muted-foreground border-border',
};

/**
 * Módulo de cálculo do Forecast (projeção de alunos ativos).
 *
 * Funil de 6 etapas:
 *   1. Investimento em tráfego
 *   2. Conversas iniciadas   = investimento / custo por conversa
 *   3. Leads no CRM          = conversas * taxa_conversa_lead
 *   4. Agendamentos          = leads * taxa_lead_agendamento
 *   5. Comparecimentos       = agendamentos * taxa_agendamento_comparecimento
 *   6. Matrículas            = comparecimentos * taxa_comparecimento_matricula
 *
 * Base de alunos:
 *   cancelamentos = base_inicial * churn_mensal
 *   base_final    = min(base_inicial - cancelamentos + matriculas, capacidade_maxima)
 */

export interface ForecastPremissas {
  investimentoPrevisto: number;
  custoPorConversa?: number | null;
  taxaConversaLead: number;
  taxaLeadAgendamento: number;
  taxaAgendamentoComparecimento: number;
  taxaComparecimentoMatricula: number;
  churnMensal: number;
  ticketMedio?: number | null;
  capacidadeMaxima?: number | null;
}

export interface ForecastFunil {
  investimento: number;
  conversas: number | null;
  leads: number | null;
  agendamentos: number | null;
  comparecimentos: number | null;
  matriculas: number | null;
}

export interface ForecastMes {
  ano: number;
  mes: number;
  funil: ForecastFunil;
  baseInicial: number;
  cancelamentos: number;
  matriculas: number;
  baseFinal: number;
  ocupacao: number | null;
  receitaPrevista: number | null;
  cac: number | null;
  capacidadeAtingida: boolean;
}

const clampTaxa = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0);
const num = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Calcula o funil do mês a partir das premissas. Retorna nulls quando falta o custo por conversa. */
export function calcularFunil(
  premissas: ForecastPremissas,
  conversasInformadas?: number | null,
): ForecastFunil {
  const investimento = num(premissas.investimentoPrevisto);
  const custo = num(premissas.custoPorConversa);

  let conversas: number | null = null;
  if (typeof conversasInformadas === 'number' && Number.isFinite(conversasInformadas)) {
    conversas = Math.max(conversasInformadas, 0);
  } else if (custo > 0) {
    conversas = investimento / custo;
  }

  if (conversas === null) {
    return { investimento, conversas: null, leads: null, agendamentos: null, comparecimentos: null, matriculas: null };
  }

  const leads = conversas * clampTaxa(premissas.taxaConversaLead);
  const agendamentos = leads * clampTaxa(premissas.taxaLeadAgendamento);
  const comparecimentos = agendamentos * clampTaxa(premissas.taxaAgendamentoComparecimento);
  const matriculas = comparecimentos * clampTaxa(premissas.taxaComparecimentoMatricula);

  return {
    investimento,
    conversas: round(conversas, 1),
    leads: round(leads, 1),
    agendamentos: round(agendamentos, 1),
    comparecimentos: round(comparecimentos, 1),
    matriculas: round(matriculas, 1),
  };
}

/** Projeta um único mês, partindo da base inicial de alunos ativos. */
export function projetarMes(params: {
  ano: number;
  mes: number;
  baseInicial: number;
  premissas: ForecastPremissas;
  conversasInformadas?: number | null;
}): ForecastMes {
  const { ano, mes, premissas } = params;
  const baseInicial = Math.max(num(params.baseInicial), 0);
  const funil = calcularFunil(premissas, params.conversasInformadas);

  const cancelamentos = round(baseInicial * clampTaxa(premissas.churnMensal), 1);
  const matriculas = num(funil.matriculas);
  const capacidade = premissas.capacidadeMaxima ?? null;

  const bruto = baseInicial - cancelamentos + matriculas;
  const baseFinal = capacidade && capacidade > 0 ? Math.min(bruto, capacidade) : bruto;

  const ticket = premissas.ticketMedio ?? null;
  const investimento = num(premissas.investimentoPrevisto);

  return {
    ano,
    mes,
    funil,
    baseInicial,
    cancelamentos,
    matriculas,
    baseFinal: round(baseFinal, 1),
    ocupacao: capacidade && capacidade > 0 ? round((baseFinal / capacidade) * 100, 1) : null,
    receitaPrevista: ticket && ticket > 0 ? round(baseFinal * ticket, 2) : null,
    cac: matriculas > 0 && investimento > 0 ? round(investimento / matriculas, 2) : null,
    capacidadeAtingida: !!(capacidade && capacidade > 0 && bruto >= capacidade),
  };
}

/** Projeta N meses encadeados: a base final de um mês é a base inicial do seguinte. */
export function projetarMeses(params: {
  anoInicial: number;
  mesInicial: number;
  baseInicial: number;
  meses: number;
  premissasPorMes: (ano: number, mes: number, indice: number) => ForecastPremissas;
}): ForecastMes[] {
  const resultado: ForecastMes[] = [];
  let base = params.baseInicial;
  let ano = params.anoInicial;
  let mes = params.mesInicial;

  for (let i = 0; i < Math.max(params.meses, 0); i++) {
    const premissas = params.premissasPorMes(ano, mes, i);
    const projecao = projetarMes({ ano, mes, baseInicial: base, premissas });
    resultado.push(projecao);
    base = projecao.baseFinal;
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }

  return resultado;
}

/**
 * Meta reversa: quanto investir para atingir a meta de alunos ativos no fim do mês.
 * Retorna null quando as premissas não permitem o cálculo (taxa zerada, sem custo por conversa).
 */
export function metaReversa(params: {
  metaAlunosAtivos: number;
  baseInicial: number;
  premissas: ForecastPremissas;
}): {
  matriculasNecessarias: number;
  comparecimentosNecessarios: number | null;
  agendamentosNecessarios: number | null;
  leadsNecessarios: number | null;
  conversasNecessarias: number | null;
  investimentoNecessario: number | null;
} {
  const { premissas } = params;
  const baseInicial = Math.max(num(params.baseInicial), 0);
  const cancelamentos = baseInicial * clampTaxa(premissas.churnMensal);
  const matriculasNecessarias = Math.max(params.metaAlunosAtivos - (baseInicial - cancelamentos), 0);

  const tMat = clampTaxa(premissas.taxaComparecimentoMatricula);
  const tComp = clampTaxa(premissas.taxaAgendamentoComparecimento);
  const tAgend = clampTaxa(premissas.taxaLeadAgendamento);
  const tLead = clampTaxa(premissas.taxaConversaLead);
  const custo = num(premissas.custoPorConversa);

  const comparecimentos = tMat > 0 ? matriculasNecessarias / tMat : null;
  const agendamentos = comparecimentos !== null && tComp > 0 ? comparecimentos / tComp : null;
  const leads = agendamentos !== null && tAgend > 0 ? agendamentos / tAgend : null;
  const conversas = leads !== null && tLead > 0 ? leads / tLead : null;
  const investimento = conversas !== null && custo > 0 ? conversas * custo : null;

  return {
    matriculasNecessarias: round(matriculasNecessarias, 1),
    comparecimentosNecessarios: comparecimentos === null ? null : round(comparecimentos, 1),
    agendamentosNecessarios: agendamentos === null ? null : round(agendamentos, 1),
    leadsNecessarios: leads === null ? null : round(leads, 1),
    conversasNecessarias: conversas === null ? null : round(conversas, 1),
    investimentoNecessario: investimento === null ? null : round(investimento, 2),
  };
}

/** Taxas realizadas a partir de números absolutos do CRM. Null quando o denominador é zero. */
export function taxasRealizadas(dados: {
  conversas?: number | null;
  leads?: number | null;
  agendamentos?: number | null;
  comparecimentos?: number | null;
  matriculas?: number | null;
}) {
  const div = (a?: number | null, b?: number | null) =>
    typeof a === 'number' && typeof b === 'number' && b > 0 ? round(a / b, 4) : null;

  return {
    taxaConversaLead: div(dados.leads, dados.conversas),
    taxaLeadAgendamento: div(dados.agendamentos, dados.leads),
    taxaAgendamentoComparecimento: div(dados.comparecimentos, dados.agendamentos),
    taxaComparecimentoMatricula: div(dados.matriculas, dados.comparecimentos),
  };
}

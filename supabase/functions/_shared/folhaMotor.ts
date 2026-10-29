// Motor único de cálculo da folha EVO.
// Fonte: meuappfelizevo.zip — public/evo.html (calc, xr, isProfessor, isRecepcao, payRules)
// e public/evo-domain.js (discount, salaryBase, included, commission, diárias).
// Não altere fórmulas sem nova referência do negócio.

export type TipoColab = "CLT" | "ESTAGIARIO" | "SEM_CONTRATO";

export interface Faixa { a: number; b: number | null; v: number }

export interface RegrasFolha {
  diaria: number;          // d  — diária (estagiário)
  diaria_fds: number;      // df — diária de fim de semana (estagiário)
  diaria_normal: number;   // dn — diária normal (estagiário)
  fds: number;             // valor por dia/turno de 6h do estagiário
  clt_fds_professor: number; // f — valor por fim de semana do professor CLT
  lider: number;           // adicional de líder (estagiário)
  bolsa: number;           // bolsa padrão sugerida no cadastro de estagiário
  passagem: number;        // passagem padrão sugerida no cadastro de estagiário
  xmode: "mes" | "aula";   // faixa das experimentais: total do mês ou por aula
  faixas: Faixa[];
  comissoes: Record<string, number>; // comm_<plano>_<periodo>
}

export const COMM_PLANS = [["completo", "Plano Completo"], ["executivo", "Plano Executivo"]] as const;
export const COMM_PERIODS = [["mensal", "Mensal"], ["semestral", "Semestral"], ["anual", "Anual"]] as const;
export const COMM_DEFAULT: Record<string, number> = {
  comm_completo_mensal: 749.99, comm_completo_semestral: 639.99, comm_completo_anual: 599.99,
  comm_executivo_mensal: 599.99, comm_executivo_semestral: 579.99, comm_executivo_anual: 499.99,
};

export const REGRAS_PADRAO: RegrasFolha = {
  diaria: 30, diaria_fds: 50, diaria_normal: 20, fds: 100, clt_fds_professor: 200, lider: 300,
  bolsa: 600, passagem: 80, xmode: "mes",
  faixas: [{ a: 1, b: 4, v: 20 }, { a: 5, b: 7, v: 25 }, { a: 8, b: 10, v: 30 }, { a: 11, b: null, v: 40 }],
  comissoes: { ...COMM_DEFAULT },
};

export interface Saude { blue?: boolean; ultra?: boolean; dental?: boolean; quantity?: number }
export interface LancTurno { d?: number; df?: number; dn?: number; f?: number; h?: number; x?: number[]; health?: Saude }
export interface Lancamento extends LancTurno {
  comissao_manual?: number;
  datas_fds?: string[];
  ajuda_custo?: { passagem: number; alimentacao: number; datas?: [string, string]; ajustes: { id: string; descricao: string; tipo: "adicional" | "desconto"; valor: number }[] };
  ajustes?: { id: string; descricao: string; tipo: "adicional" | "desconto"; valor: number }[];
  opt?: { bolsa?: boolean; passagem?: boolean };
  salary?: { net?: number; gross?: number };
  comm?: Record<string, Record<string, { c?: number; f?: number }>>;
  s2?: LancTurno;
}

export interface Colaborador {
  id: string; nome: string; tipo: TipoColab; funcao?: string | null;
  /** Classificação remuneratória explícita do colaborador (não é perfil de acesso). */
  funcao_remuneratoria?: FuncaoRemuneratoria | null;
  turno?: string | null; turno2?: string | null;
  base: number; passagem: number; lider?: boolean; lider_valor?: number | null;
  valor_fds?: number | null; valor_feriado?: number | null;
}

const amount = (v: unknown) => Math.max(0, Number(v) || 0);
const cents = (v: number) => Math.round((Number(v) || 0) * 100) / 100;
const qty = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 0 ? n : 0; };
const norm = (s: unknown) => String(s || "").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function desconto(h?: Saude): number {
  h = h || {};
  return (h.blue ? 50 : 0) + (h.ultra ? 80 : 0) + (h.dental ? 12 * Math.floor(amount(h.quantity)) : 0);
}

export function faixaExperimental(n: number, faixas: Faixa[]): number {
  n = Math.floor(Math.max(0, Number(n) || 0));
  if (n < 1) return 0;
  const t = faixas.find((t) => n >= t.a && (t.b == null || n <= t.b));
  return t ? Math.max(0, Number(t.v) || 0) : 0;
}

/** Funções de professor formado: identificadores fixos, independentes do texto livre "Função". */
export const FUNCOES_REMUNERATORIAS = { COORDENADOR_TURNO: "Coordenador de Turno", COORDENADOR_GERAL: "Coordenador Geral" } as const;
export type FuncaoRemuneratoria = keyof typeof FUNCOES_REMUNERATORIAS;
export const FUNCOES_FORMADO: readonly FuncaoRemuneratoria[] = ["COORDENADOR_TURNO", "COORDENADOR_GERAL"];
/** Regra histórica (até v4): texto PROFESSOR. Mantida só para recalcular retratos fechados nessas versões. */
export const isProfessor = (c: Colaborador) => c.tipo === "CLT" && norm(c.funcao) === "PROFESSOR";
/** v5+: formado somente pelo identificador explícito da função remuneratória. */
export const isFormado = (c: Colaborador, versao = VERSAO_CALCULO) =>
  versao === VERSAO_CALCULO ? c.tipo === "CLT" && !!c.funcao_remuneratoria && FUNCOES_FORMADO.includes(c.funcao_remuneratoria) : isProfessor(c);
export const isRecepcao = (c: Colaborador) => c.tipo === "CLT" && norm(c.funcao).includes("RECEP");

function turnos(c: Colaborador) {
  const t1 = String(c.turno || ""), t2 = String(c.turno2 || "");
  const out: string[] = []; if (t1) out.push(t1); if (t2 && t2 !== t1) out.push(t2); return out;
}
export const temSegundoTurno = (c: Colaborador) => turnos(c).length > 1;

export function comissao(l: Lancamento | undefined, regras: RegrasFolha) {
  const comm = l?.comm || {};
  const rates: Record<string, number> = {};
  for (const k in COMM_DEFAULT) {
    const v = regras.comissoes?.[k];
    rates[k] = v != null && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : COMM_DEFAULT[k];
  }
  let cadastro = 0, fechamento = 0;
  const linhas = [];
  for (const [p, pl] of COMM_PLANS) for (const [q, ql] of COMM_PERIODS) {
    const ref = rates[`comm_${p}_${q}`], c = qty(comm[p]?.[q]?.c), f = qty(comm[p]?.[q]?.f);
    const sc = cents(c * ref * 0.03), sf = cents(f * ref * 0.02);
    cadastro += sc; fechamento += sf;
    linhas.push({ plano: p, planoLabel: pl, periodo: q, periodoLabel: ql, ref, c, f, sc, sf });
  }
  cadastro = cents(cadastro); fechamento = cents(fechamento);
  return { cadastro, fechamento, total: cents(cadastro + fechamento), linhas };
}

export interface ResultadoFolha {
  ajudaCusto?: { passagem: number; alimentacao: number; ajustes: number; total: number };
  base: number; passagem: number; lider: number; comissao: number;
  valores: { d: number; df: number; dn: number; f: number; h: number; x: number };
  quantidades: { d: number; df: number; dn: number; f: number; h: number; x: number; alunos: number };
  extras: number; bruto: number; desconto: number; total: number;
  segundoTurno: boolean; contrachequeImportado: boolean;
}

/**
 * Calcula a folha de um colaborador numa competência.
 * `liquidoImportado`: líquido de contracheque CLT importado — substitui o cálculo (evo.html totalsFor).
 */
export function calcularFolha(c: Colaborador, l: Lancamento | undefined, regras: RegrasFolha, liquidoImportado?: number | null, versao = VERSAO_CALCULO): ResultadoFolha {
  if (c.tipo === "SEM_CONTRATO") throw new Error("Sem contrato: regra de cálculo pendente; ativação financeira recusada");
  const lan = l || {};
  const nova = regrasExplicitas(versao);
  const manual = nova || versao === "evo-comissao-manual-ajuda-separada-v3";
  const est = c.tipo === "ESTAGIARIO";
  const two = est && temSegundoTurno(c);
  const s2 = two ? lan.s2 || {} : null;
  const exigido = (v: unknown, campo: string) => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error(`Cálculo indisponível: configuração explícita ausente ou inválida — ${campo}`);
    return v;
  };
  if (nova) {
    for (const sl of [lan, ...(s2 ? [s2] : [])]) {
      for (const [k, campo] of [["d", "diaria"], ["dn", "diaria_normal"]] as const) if (est && amount(sl[k]) > 0) exigido(regras[campo], campo);
      if ((est && amount(sl.df) > 0) || amount(sl.f) > 0) throw new Error("Cálculo indisponível: informe as datas dos dias de final de semana, sem contagens por turno");
      if (amount(sl.h) > 0) exigido(c.valor_feriado, "valor_feriado do colaborador");
      if ((sl.x || []).some(n => n > 0) && (!["mes", "aula"].includes(regras.xmode) || !Array.isArray(regras.faixas) || !regras.faixas.length || regras.faixas.some(f => !Number.isFinite(f.v) || f.v < 0))) throw new Error("Cálculo indisponível: configure explicitamente as faixas de experimentais");
    }
    if (est && c.lider) exigido(c.lider_valor ?? regras.lider, "adicional de líder");
    if (c.tipo !== "CLT" || liquidoImportado == null) exigido(lan.salary?.net ?? c.base, "salário/bolsa do colaborador");
    exigido(c.passagem, "passagem do colaborador");
  }
  const datas = nova ? diasFdsUnicos(lan.datas_fds ?? []) : [];
  const fdsUnit = nova && datas.length ? (est ? exigido(regras.fds, "dia FDS estagiário") : isFormado(c, versao) ? exigido(regras.clt_fds_professor, "dia FDS professor formado") : exigido(c.valor_fds, "dia FDS do colaborador")) : est ? amount(regras.fds) : isFormado(c, versao) ? amount(regras.clt_fds_professor) : amount(c.valor_fds);

  const parte = (sl: LancTurno) => {
    const q = (k: "d" | "df" | "dn" | "f" | "h") => Number(sl[k]) || 0;
    const xa = (sl.x || []).map((n) => Math.floor(amount(n)));
    const xt = xa.reduce((a, b) => a + b, 0);
    const xe = (n: number) => {
      const valor = faixaExperimental(regras.xmode === "aula" ? n : xt, regras.faixas || []);
      if (nova && n > 0 && !(regras.faixas || []).some(f => (regras.xmode === "aula" ? n : xt) >= f.a && (f.b == null || (regras.xmode === "aula" ? n : xt) <= f.b))) throw new Error("Cálculo indisponível: faixa experimental não configurada");
      return n * valor;
    };
    const fq = nova ? 0 : est ? Math.min(2, Math.floor(amount(q("f")))) : q("f");
    return {
      l: { d: est ? q("d") : 0, df: est ? q("df") : 0, dn: est ? q("dn") : 0, f: fq, h: q("h"), x: xa.length, alunos: xt },
      v: {
        d: est ? q("d") * amount(regras.diaria) : 0,
        df: est ? q("df") * amount(regras.diaria_fds) : 0,
        dn: est ? q("dn") * amount(regras.diaria_normal) : 0,
        f: fq * fdsUnit,
        h: q("h") * amount(c.valor_feriado),
        x: xa.reduce((a, n) => a + xe(n), 0),
      },
    };
  };
  const p1 = parte(lan), p2 = s2 ? parte(s2) : null;
  const sum = <K extends keyof typeof p1.v>(k: K) => p1.v[k] + (p2 ? p2.v[k] : 0);
  const sq = <K extends keyof typeof p1.l>(k: K) => p1.l[k] + (p2 ? p2.l[k] : 0);
  const v = { d: sum("d"), df: sum("df"), dn: sum("dn"), f: sum("f"), h: sum("h"), x: sum("x") };
  if (nova) v.f = cents(datas.length * fdsUnit);
  const lider = est && c.lider ? amount(c.lider_valor ?? regras.lider) : 0;

  const incB = est ? lan.opt?.bolsa !== false : true;
  const incP = est ? lan.opt?.passagem !== false : true;
  const mult = p2 ? 2 : 1;
  const salarioBase = c.tipo === "CLT" && lan.salary && Object.prototype.hasOwnProperty.call(lan.salary, "net")
    ? amount(lan.salary.net) : amount(c.base);
  const base = incB ? salarioBase * mult : 0;
  const passagem = incP ? amount(c.passagem) * mult : 0;
  const historica = !manual;
  if (!historica && lan.comissao_manual !== undefined && (typeof lan.comissao_manual !== "number" || !Number.isFinite(lan.comissao_manual) || lan.comissao_manual < 0)) throw new Error("Comissão manual deve ser um valor não negativo");
  const comm = historica ? (!est && isRecepcao(c) ? comissao(lan, regras).total : 0) : cents(lan.comissao_manual ?? 0);
  const ajudaCusto = !historica ? calcularAjudaCusto(c, lan.ajuda_custo) : undefined;
  const ajustes = lan.ajustes || [];
  for (const a of ajustes) if (!a.id || !a.descricao?.trim() || !["adicional", "desconto"].includes(a.tipo) || !Number.isFinite(a.valor) || a.valor < 0) throw new Error("Adicional/desconto inválido");
  const adicionais = ajustes.filter((a) => a.tipo === "adicional").reduce((s, a) => s + a.valor, 0);
  const descontosIdentificados = ajustes.filter((a) => a.tipo === "desconto").reduce((s, a) => s + a.valor, 0);
  const extras = lider + v.d + v.df + v.dn + v.f + v.h + v.x + adicionais;
  const bruto = cents(base + passagem + extras + comm);
  const quantidades = { d: sq("d"), df: sq("df"), dn: sq("dn"), f: sq("f"), h: sq("h"), x: sq("x"), alunos: sq("alunos") };
  if (nova) quantidades.f = datas.length;

  if (c.tipo === "CLT" && liquidoImportado != null) {
    const t = cents(amount(liquidoImportado));
    return { ajudaCusto, base, passagem, lider, comissao: comm, valores: v, quantidades, extras, bruto: t, desconto: 0, total: t, segundoTurno: false, contrachequeImportado: true };
  }
  const desc = cents(desconto(lan.health) + (p2 ? desconto(s2?.health) : 0) + descontosIdentificados);
  return { ajudaCusto, base, passagem, lider, comissao: comm, valores: v, quantidades, extras: cents(extras), bruto, desconto: desc, total: cents(bruto - desc), segundoTurno: !!p2, contrachequeImportado: false };
}

export function mesclarRegras(r: Partial<RegrasFolha> | null | undefined, versao = VERSAO_CALCULO): RegrasFolha {
  if (regrasExplicitas(versao)) return { ...(r || {}), faixas: r?.faixas || [], comissoes: r?.comissoes || {} } as RegrasFolha;
  return { ...REGRAS_PADRAO, ...(r || {}), comissoes: { ...COMM_DEFAULT, ...(r?.comissoes || {}) }, faixas: r?.faixas?.length ? r.faixas : REGRAS_PADRAO.faixas };
}

/** Versão do motor gravada em cada fechamento. Altere ao mudar qualquer fórmula. */
export const VERSAO_CALCULO = "evo-funcao-remuneratoria-formado-v5";
/** Versões com configuração explícita, datas FDS e ajuda parcelada (v4 preservada para retratos fechados). */
export const VERSOES_EXPLICITAS = ["evo-dias-fds-parcelas-config-explicita-v4", VERSAO_CALCULO] as const;
export const regrasExplicitas = (versao: string) => (VERSOES_EXPLICITAS as readonly string[]).includes(versao);

export function diasFdsUnicos(datas: string[]) {
  if (!Array.isArray(datas)) throw new Error("Datas FDS inválidas");
  for (const s of datas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Data FDS inválida");
    const [y,m,d] = s.split("-").map(Number), dt = new Date(y,m-1,d);
    if (dt.getFullYear()!==y || dt.getMonth()!==m-1 || dt.getDate()!==d || ![0,6].includes(dt.getDay())) throw new Error("Informe somente sábado ou domingo efetivamente trabalhado");
  }
  return [...new Set(datas)].sort();
}

export function dividirAjuda(total: number): [number, number] {
  if (!Number.isFinite(total) || total < 0) throw new Error("Total da ajuda inválido");
  const centavos = Math.round(total * 100), primeira = Math.round(centavos / 2);
  return [primeira / 100, (centavos - primeira) / 100];
}

/** Valores aprovados para a competência, sem inferir dias ou periodicidade. Nunca entram no líquido. */
export function calcularAjudaCusto(c: Colaborador, ajuda: Lancamento["ajuda_custo"]) {
  if (!ajuda) return { passagem: 0, alimentacao: 0, ajustes: 0, total: 0 };
  if (c.tipo !== "CLT") throw new Error("Ajuda de custo discriminada é exclusiva de CLT");
  for (const v of [ajuda.passagem, ajuda.alimentacao]) if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new Error("Ajuda de custo inválida");
  if (!Array.isArray(ajuda.ajustes) || new Set(ajuda.ajustes.map(a => a.id)).size !== ajuda.ajustes.length) throw new Error("Ajustes da ajuda inválidos");
  let ajustes = 0;
  for (const a of ajuda.ajustes) {
    if (!a.id || !a.descricao?.trim() || !["adicional", "desconto"].includes(a.tipo) || typeof a.valor !== "number" || !Number.isFinite(a.valor) || a.valor < 0) throw new Error("Ajuste da ajuda exige identificação e valor não negativo");
    ajustes += a.tipo === "adicional" ? a.valor : -a.valor;
  }
  const total = cents(ajuda.passagem + ajuda.alimentacao + ajustes);
  if (total < 0) throw new Error("Total da ajuda de custo não pode ser negativo");
  return { passagem: cents(ajuda.passagem), alimentacao: cents(ajuda.alimentacao), ajustes: cents(ajustes), total };
}

export interface LancamentoPersistido { colaborador_id: string; dados: Lancamento; liquido_importado: number | null }

/** Quem entra na folha: quem tem lançamento, ou está ativo enquanto a competência está aberta. */
export function linhasCompetencia<C extends Colaborador & { ativo?: boolean }>(colabs: C[], lancs: LancamentoPersistido[], regras: RegrasFolha, aberta: boolean, versao = VERSAO_CALCULO) {
  const por = new Map(lancs.map((l) => [l.colaborador_id, l]));
  return colabs
    .filter((c) => c.tipo !== "SEM_CONTRATO" && (por.has(c.id) || (aberta && c.ativo !== false)))
    .map((c) => {
      const l = por.get(c.id);
      return { colaborador: c, lancamento: l, resultado: calcularFolha(c, l?.dados, regras, l?.liquido_importado ?? null, versao) };
    });
}

/* ---------------- Ajuda de Custo mensal (fonte única: folha_ajuda_lancamentos) ---------------- */
export interface AjusteAjuda { id: string; descricao: string; tipo: "adicional" | "desconto"; valor: number; origem?: string }
export interface AjudaMensal {
  passagem_dia?: number; dias_uteis?: number; dias_adicionais?: number;
  /** Substitui (não soma) passagem_dia × dias_adicionais. Exige motivo. */
  passagem_adicional_manual?: { valor: number; motivo: string } | null;
  alimentacao_dia?: number; dias_alimentacao?: number;
  ajustes?: AjusteAjuda[]; datas?: [string, string];
}
const naoNeg = (v: unknown, nome: string, inteiro = false) => {
  if (v === undefined || v === null) return 0;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || (inteiro && !Number.isInteger(v))) throw new Error(`${nome} inválido`);
  return v;
};
/** Total = passagem/dia × dias úteis + (passagem manual OU passagem/dia × dias adicionais) + alimentação/dia × dias + ajustes. Em centavos. */
export function calcularAjudaMensal(a: AjudaMensal | null | undefined) {
  const d = a || {};
  const pd = naoNeg(d.passagem_dia, "Passagem diária"), du = naoNeg(d.dias_uteis, "Dias úteis", true), da = naoNeg(d.dias_adicionais, "Dias adicionais", true);
  const ad = naoNeg(d.alimentacao_dia, "Alimentação diária"), dal = naoNeg(d.dias_alimentacao, "Dias de alimentação", true);
  const c = (v: number) => Math.round(v * 100);
  const passagemUteis = c(pd) * du;
  let passagemAdicional = c(pd) * da, manual = false;
  if (d.passagem_adicional_manual) {
    const m = d.passagem_adicional_manual;
    if (!m.motivo?.trim()) throw new Error("Passagem adicional manual exige motivo");
    passagemAdicional = c(naoNeg(m.valor, "Passagem adicional manual")); manual = true;
  }
  const alimentacao = c(ad) * dal;
  const ajustes = d.ajustes || [];
  if (new Set(ajustes.map((x) => x.id)).size !== ajustes.length) throw new Error("Ajustes da ajuda duplicados");
  let aj = 0;
  for (const x of ajustes) {
    if (!x.id || !x.descricao?.trim() || !["adicional", "desconto"].includes(x.tipo)) throw new Error("Ajuste da ajuda exige descrição e tipo");
    aj += (x.tipo === "adicional" ? 1 : -1) * c(naoNeg(x.valor, "Valor do ajuste"));
  }
  const total = passagemUteis + passagemAdicional + alimentacao + aj;
  if (total < 0) throw new Error("Total da ajuda de custo não pode ser negativo");
  const primeira = Math.round(total / 2);
  return {
    passagemUteis: passagemUteis / 100, passagemAdicional: passagemAdicional / 100, passagemManual: manual,
    alimentacao: alimentacao / 100, ajustes: aj / 100, total: total / 100,
    parcelas: [primeira / 100, (total - primeira) / 100] as [number, number],
  };
}

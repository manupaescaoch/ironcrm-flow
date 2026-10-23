// Regras puras de período e cálculo do assistente financeiro (fuso America/Recife).

export type Periodo =
  | 'hoje' | 'semana_atual' | 'semana_passada' | 'mes_atual' | 'mes_passado'
  | 'proximos_7_dias' | 'ate_domingo' | 'personalizado' | 'nenhum';

export function hojeRecife(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife' }).format(now);
}

function d(iso: string): Date { const [a, m, dd] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, dd)); }
function iso(x: Date): string { return x.toISOString().slice(0, 10); }
function add(isoStr: string, n: number): string { const x = d(isoStr); x.setUTCDate(x.getUTCDate() + n); return iso(x); }

/** Segunda-feira da semana (seg–dom) que contém a data. */
export function segundaDaSemana(isoStr: string): string {
  const wd = d(isoStr).getUTCDay(); // 0=dom
  return add(isoStr, wd === 0 ? -6 : 1 - wd);
}

export function intervalo(periodo: Periodo, hoje: string, inicio?: string | null, fim?: string | null): { inicio: string; fim: string; rotulo: string } {
  const br = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  const brAno = (s: string) => `${br(s)}/${s.slice(0, 4)}`;
  switch (periodo) {
    case 'hoje': return { inicio: hoje, fim: hoje, rotulo: `HOJE ${brAno(hoje)}` };
    case 'semana_passada': {
      const seg = add(segundaDaSemana(hoje), -7);
      return { inicio: seg, fim: add(seg, 6), rotulo: `SEMANA PASSADA ${br(seg)} A ${brAno(add(seg, 6))}` };
    }
    case 'mes_atual': case 'mes_passado': {
      let [a, m] = hoje.split('-').map(Number);
      if (periodo === 'mes_passado') { m -= 1; if (m === 0) { m = 12; a -= 1; } }
      const ini = `${a}-${String(m).padStart(2, '0')}-01`;
      const f = iso(new Date(Date.UTC(a, m, 0)));
      return { inicio: ini, fim: f, rotulo: `${periodo === 'mes_atual' ? 'MÊS' : 'MÊS PASSADO'} ${String(m).padStart(2, '0')}/${a}` };
    }
    case 'proximos_7_dias': return { inicio: hoje, fim: add(hoje, 6), rotulo: `PRÓXIMOS 7 DIAS ${br(hoje)} A ${brAno(add(hoje, 6))}` };
    case 'ate_domingo': { const dom = add(segundaDaSemana(hoje), 6); return { inicio: hoje, fim: dom, rotulo: `HOJE ATÉ DOMINGO ${br(hoje)} A ${brAno(dom)}` }; }
    case 'personalizado': {
      const ok = (s?: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (ok(inicio) && ok(fim) && inicio! <= fim!) return { inicio: inicio!, fim: fim!, rotulo: `${brAno(inicio!)} A ${brAno(fim!)}` };
      // cai para semana atual
    }
    // falls through
    case 'semana_atual': case 'nenhum': default: {
      const seg = segundaDaSemana(hoje);
      return { inicio: seg, fim: add(seg, 6), rotulo: `SEMANA ${br(seg)} A ${brAno(add(seg, 6))}` };
    }
  }
}

export interface ContaCalc {
  status: string; valor: number | string; valor_pago?: number | string | null;
  data_vencimento: string; data_pagamento_prevista?: string | null; data_pagamento?: string | null;
}

/** Data que vale para "em aberto": prevista (reagendada) ou vencimento. Uma única data → sem duplicidade. */
export const dataEfetiva = (c: ContaCalc) => String(c.data_pagamento_prevista ?? c.data_vencimento).slice(0, 10);
/** Saldo pendente: valor menos o já pago (parcial). */
export const saldoPendente = (c: ContaCalc) => Math.max(0, Number(c.valor) - Number(c.valor_pago ?? 0));
/** Valor efetivamente pago. */
export const valorPago = (c: ContaCalc) => Number(c.valor_pago ?? c.valor);

export function classificar(contas: ContaCalc[], inicio: string, fim: string) {
  const abertas = contas.filter((c) => c.status === 'pendente' && dataEfetiva(c) >= inicio && dataEfetiva(c) <= fim && saldoPendente(c) > 0);
  const vencidasAnteriores = contas.filter((c) => c.status === 'pendente' && dataEfetiva(c) < inicio && saldoPendente(c) > 0);
  const pagas = contas.filter((c) => c.status === 'paga' && c.data_pagamento && c.data_pagamento >= inicio && c.data_pagamento <= fim);
  return { abertas, vencidasAnteriores, pagas };
}

import { describe, expect, it } from 'vitest';
import { calcularFunil, metaReversa, projetarMes, projetarMeses, taxasRealizadas, type ForecastPremissas } from './calc';

const premissas: ForecastPremissas = {
  investimentoPrevisto: 10000,
  custoPorConversa: 10,
  taxaConversaLead: 0.5,
  taxaLeadAgendamento: 0.5,
  taxaAgendamentoComparecimento: 0.5,
  taxaComparecimentoMatricula: 0.2,
  churnMensal: 0.05,
  ticketMedio: 200,
  capacidadeMaxima: 500,
};

describe('calcularFunil', () => {
  it('deriva o funil a partir do investimento', () => {
    const f = calcularFunil(premissas);
    expect(f.conversas).toBe(1000);
    expect(f.leads).toBe(500);
    expect(f.agendamentos).toBe(250);
    expect(f.comparecimentos).toBe(125);
    expect(f.matriculas).toBe(25);
  });

  it('retorna nulls quando não há custo por conversa nem conversas informadas', () => {
    const f = calcularFunil({ ...premissas, custoPorConversa: null });
    expect(f.conversas).toBeNull();
    expect(f.matriculas).toBeNull();
  });

  it('prioriza conversas informadas sobre o cálculo pelo investimento', () => {
    const f = calcularFunil(premissas, 200);
    expect(f.conversas).toBe(200);
    expect(f.matriculas).toBe(5);
  });

  it('limita taxas fora do intervalo 0..1', () => {
    const f = calcularFunil({ ...premissas, taxaConversaLead: 5 });
    expect(f.leads).toBe(1000);
  });
});

describe('projetarMes', () => {
  it('calcula base final, churn, ocupação, receita e CAC', () => {
    const p = projetarMes({ ano: 2026, mes: 8, baseInicial: 300, premissas });
    expect(p.cancelamentos).toBe(15);
    expect(p.matriculas).toBe(25);
    expect(p.baseFinal).toBe(310);
    expect(p.ocupacao).toBe(62);
    expect(p.receitaPrevista).toBe(62000);
    expect(p.cac).toBe(400);
    expect(p.capacidadeAtingida).toBe(false);
  });

  it('respeita a capacidade máxima', () => {
    const p = projetarMes({ ano: 2026, mes: 8, baseInicial: 495, premissas: { ...premissas, churnMensal: 0 } });
    expect(p.baseFinal).toBe(500);
    expect(p.capacidadeAtingida).toBe(true);
  });

  it('não gera ocupação nem receita sem capacidade e ticket', () => {
    const p = projetarMes({
      ano: 2026,
      mes: 8,
      baseInicial: 100,
      premissas: { ...premissas, capacidadeMaxima: null, ticketMedio: null },
    });
    expect(p.ocupacao).toBeNull();
    expect(p.receitaPrevista).toBeNull();
  });
});

describe('projetarMeses', () => {
  it('encadeia a base e vira o ano corretamente', () => {
    const meses = projetarMeses({
      anoInicial: 2026,
      mesInicial: 11,
      baseInicial: 100,
      meses: 3,
      premissasPorMes: () => ({ ...premissas, churnMensal: 0, capacidadeMaxima: null }),
    });
    expect(meses.map((m) => `${m.mes}/${m.ano}`)).toEqual(['11/2026', '12/2026', '1/2027']);
    expect(meses[0].baseFinal).toBe(125);
    expect(meses[1].baseInicial).toBe(125);
    expect(meses[2].baseFinal).toBe(175);
  });
});

describe('metaReversa', () => {
  it('calcula o investimento necessário para a meta', () => {
    const r = metaReversa({ metaAlunosAtivos: 320, baseInicial: 300, premissas });
    expect(r.matriculasNecessarias).toBe(35);
    expect(r.comparecimentosNecessarios).toBe(175);
    expect(r.agendamentosNecessarios).toBe(350);
    expect(r.leadsNecessarios).toBe(700);
    expect(r.conversasNecessarias).toBe(1400);
    expect(r.investimentoNecessario).toBe(14000);
  });

  it('não retorna negativo quando a meta já está atingida', () => {
    const r = metaReversa({ metaAlunosAtivos: 100, baseInicial: 300, premissas: { ...premissas, churnMensal: 0 } });
    expect(r.matriculasNecessarias).toBe(0);
    expect(r.investimentoNecessario).toBe(0);
  });

  it('retorna null quando alguma taxa é zero', () => {
    const r = metaReversa({
      metaAlunosAtivos: 320,
      baseInicial: 300,
      premissas: { ...premissas, taxaComparecimentoMatricula: 0 },
    });
    expect(r.comparecimentosNecessarios).toBeNull();
    expect(r.investimentoNecessario).toBeNull();
  });
});

describe('taxasRealizadas', () => {
  it('calcula taxas e ignora denominadores zerados', () => {
    const t = taxasRealizadas({ conversas: 1000, leads: 400, agendamentos: 200, comparecimentos: 0, matriculas: 0 });
    expect(t.taxaConversaLead).toBe(0.4);
    expect(t.taxaLeadAgendamento).toBe(0.5);
    expect(t.taxaAgendamentoComparecimento).toBe(0);
    expect(t.taxaComparecimentoMatricula).toBeNull();
  });
});

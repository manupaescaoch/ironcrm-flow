import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { classificar, intervalo } from './contasPagarPeriodos.ts';

const HOJE = '2026-10-23'; // sexta

Deno.test('semana atual é segunda a domingo (19 a 25/10)', () => {
  const r = intervalo('semana_atual', HOJE);
  assertEquals([r.inicio, r.fim], ['2026-10-19', '2026-10-25']);
});

Deno.test('semana passada é 12 a 18/10, não os últimos 7 dias', () => {
  const r = intervalo('semana_passada', HOJE);
  assertEquals([r.inicio, r.fim], ['2026-10-12', '2026-10-18']);
});

Deno.test('mês atual vai do dia 1 ao último dia', () => {
  const r = intervalo('mes_atual', HOJE);
  assertEquals([r.inicio, r.fim], ['2026-10-01', '2026-10-31']);
});

Deno.test('pago conta pela data do pagamento; aberto pela data prevista; cancelada fica fora', () => {
  const contas = [
    { status: 'paga', valor: 100, valor_pago: 100, data_vencimento: '2026-10-01', data_pagamento: '2026-10-20' },
    { status: 'pendente', valor: 200, data_vencimento: '2026-10-21', data_pagamento_prevista: '2026-10-28' },
    { status: 'pendente', valor: 50, data_vencimento: '2026-10-10' },
    { status: 'cancelada', valor: 999, data_vencimento: '2026-10-22' },
  ];
  const r = classificar(contas, '2026-10-19', '2026-10-25');
  assertEquals(r.pagas.length, 1);
  assertEquals(r.abertas.length, 0); // reagendada saiu da semana
  assertEquals(r.vencidasAnteriores.length, 1);
});

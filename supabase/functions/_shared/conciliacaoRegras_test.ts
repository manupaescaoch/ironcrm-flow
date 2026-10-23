import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decidir } from './conciliacaoRegras.ts';

const conta = { id: 'c1', unidade_id: 'bv', valor: 479.78, data_pagamento: '2026-10-23', data_vencimento: '2026-10-23', fornecedor: 'SAO BRAZ' };
const t = (o: any) => ({ id: 't', unidade_id: 'bv', data: '2026-10-23', valor: 479.78, tipo: 'debito', descricao: 'PAGAMENTO BOLETO', ...o });

Deno.test('débito único com mesmo valor concilia sozinho', () => {
  assertEquals(decidir(conta, [t({ id: 'a' })]).tipo, 'auto');
});

Deno.test('nunca usa transação de outra unidade', () => {
  assertEquals(decidir(conta, [t({ unidade_id: 'madalena' })]).tipo, 'nenhum');
});

Deno.test('débito já vinculado a outra conta não é reutilizado', () => {
  assertEquals(decidir(conta, [t({ conta_pagar_id: 'outra' })]).tipo, 'nenhum');
});

Deno.test('R$ 489,78 do mesmo fornecedor gera divergência de R$ 10,00', () => {
  const r = decidir(conta, [t({ valor: 489.78, descricao: 'BOLETO SAO BRAZ' })]);
  assertEquals(r.tipo, 'divergencia');
  if (r.tipo === 'divergencia') assertEquals(r.diferenca, 10);
});

Deno.test('dois débitos iguais sem identificação pedem escolha', () => {
  assertEquals(decidir(conta, [t({ id: 'a', data: '2026-10-22' }), t({ id: 'b', data: '2026-10-24' })]).tipo, 'ambiguo');
});

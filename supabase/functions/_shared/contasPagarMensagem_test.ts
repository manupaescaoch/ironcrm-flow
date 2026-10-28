import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { resolverDadoPagamento } from './contasPagarMensagem.ts';

const conta = { descricao: 'WHEYS VITA BRASIL', data_vencimento: '2026-10-28', valor: 3118.50, forma_pagamento: 'boleto' };

Deno.test('linha de pagamento separada preserva exatamente o dado para copiar', () => {
  const linha = '26090.82488 88362.242435 44000.000008 2 16130000311850';
  assertEquals(resolverDadoPagamento({ ...conta, linha_digitavel: linha })?.dado, linha);
});

Deno.test('link de pagamento separado preserva os parâmetros para copiar', () => {
  const link = 'https://pagamento.example/boleto?id=42&token=a_b';
  assertEquals(resolverDadoPagamento({ ...conta, link_pagamento: link })?.dado, link);
});

Deno.test('Pix copia e cola separado preserva os caracteres originais', () => {
  const pix = '000201BR.GOV.BCB.PIX/chave+a_b&123';
  assertEquals(resolverDadoPagamento({ ...conta, forma_pagamento: 'pix', codigo_pix: pix })?.dado, pix);
});
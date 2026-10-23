import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { cnpjValido, interpretarCampo, nomeNormalizado, parseData, parseValor } from './contasPagarEdicaoRegras.ts';

Deno.test('valor informado no Telegram: "R$ 350,00" vira 350', () => {
  assertEquals(parseValor('R$ 350,00'), 350);
  assertEquals(parseValor('1.234,56'), 1234.56);
  assertEquals(parseValor('abc'), null);
});

Deno.test('data de vencimento inexistente é recusada', () => {
  assertEquals(parseData('30/10/2026'), '2026-10-30');
  assertEquals(parseData('31/02/2026'), null);
});

Deno.test('CNPJ inconsistente bloqueia cadastro do fornecedor', () => {
  assertEquals(cnpjValido('62.952.303/0001-61'), true);
  assertEquals(cnpjValido('62.952.303/0001-62'), false);
  assertEquals('erro' in interpretarCampo('j', '11.111.111/1111-11'), true);
});

Deno.test('nomes de fornecedor com pontuação diferente são o mesmo', () => {
  assertEquals(nomeNormalizado('Arpeq Com. de Equip Ltda - ME'), nomeNormalizado('ARPEQ COM DE EQUIP LTDA ME'));
});

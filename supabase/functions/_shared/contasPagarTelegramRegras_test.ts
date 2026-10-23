import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { acharCorrespondencia, identificarUnidade } from './contasPagarTelegramRegras.ts';

const unidades = [
  { id: 'mad', nome: 'EVO MADALENA', cnpj: '62952303000161' },
  { id: 'bv', nome: 'EVO BOA VIAGEM', cnpj: null },
];

Deno.test('unidade pelo CNPJ do pagador, mesmo com razão social antiga', () => {
  const r = identificarUnidade({ pagador_cnpj: '62.952.303/0001-61', pagador_nome: 'IRON ACADEMIA MADALENA', cpf_cnpj: '11111111000111' }, unidades);
  assertEquals(r, { unidade_id: 'mad', metodo: 'cnpj' });
});

Deno.test('CNPJ do fornecedor nunca identifica a unidade', () => {
  const r = identificarUnidade({ pagador_cnpj: null, pagador_nome: null, cpf_cnpj: '62952303000161' }, unidades);
  assertEquals(r, null);
});

Deno.test('sem correspondência segura pede confirmação', () => {
  assertEquals(identificarUnidade({ pagador_cnpj: '99999999000199', pagador_nome: 'EMPRESA XYZ' }, unidades), null);
});

const conta = {
  id: 'c1', valor: 300, data_vencimento: '2026-10-23', linha_digitavel: null, codigo_barras: null,
  chave_nfe: '1'.repeat(44), numero_fatura: '123', fornecedor_documento: '11111111000111', status: 'pendente',
};

Deno.test('boleto da mesma nota vincula em vez de criar outra despesa', () => {
  const r = acharCorrespondencia({ cpf_cnpj: '11.111.111/0001-11', valor: 300, linha_digitavel: '2379 1234', data_vencimento: '2026-10-30' }, [conta]);
  assertEquals(r?.tipo, 'vinculo');
});

Deno.test('mesma chave NF-e é duplicidade', () => {
  const r = acharCorrespondencia({ chave_nfe: '1'.repeat(44) }, [conta]);
  assertEquals(r?.tipo, 'duplicado');
});

Deno.test('mesmo número de nota com valor diferente vai para conferência', () => {
  const r = acharCorrespondencia({ cpf_cnpj: '11111111000111', numero_documento: '123', valor: 350 }, [conta]);
  assertEquals(r, { tipo: 'vinculo', conta, divergente: true });
});

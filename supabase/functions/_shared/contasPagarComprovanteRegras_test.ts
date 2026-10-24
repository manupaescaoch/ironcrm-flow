// Testes das regras do comprovante de pagamento (puras, sem rede).
import { acharContaComprovante, ehComprovante, nomeCasa, ContaComprovante } from './contasPagarComprovanteRegras.ts';

let falhas = 0;
function ok(nome: string, cond: boolean) {
  if (!cond) { falhas++; console.error(`FALHOU: ${nome}`); } else console.log(`passou: ${nome}`);
}

const contas: ContaComprovante[] = [
  { id: 'a', valor: 300, fornecedor: 'ARPEQ COM DE EQUIP LTDA ME', fornecedor_documento: '12345678000199', descricao: 'Equipamento', data_vencimento: '2026-10-23', status: 'pendente' },
  { id: 'b', valor: 479.78, fornecedor: 'SAO BRAZ', fornecedor_documento: '99988877000155', descricao: 'Aluguel out/2026', data_vencimento: '2026-10-23', status: 'pendente' },
  { id: 'c', valor: 300, fornecedor: 'ARPEQ COM DE EQUIP LTDA ME', fornecedor_documento: '12345678000199', descricao: 'Equipamento (parcela 2)', data_vencimento: '2026-11-23', status: 'pendente' },
  { id: 'd', valor: 150, fornecedor: 'CORREIOS', fornecedor_documento: '33344455000166', descricao: 'Postagem', data_vencimento: '2026-10-20', status: 'paga' },
];

// 1. Flag da IA decide se é comprovante
ok('comprovante marcado é comprovante', ehComprovante({ comprovante_pagamento: true }) === true);
ok('boleto não é comprovante', ehComprovante({ comprovante_pagamento: false }) === false);
ok('dado antigo sem flag não é comprovante', ehComprovante({}) === false);

// 2. CNPJ + valor exato e únicos → baixa direta
const r1 = acharContaComprovante({ comprovante_pagamento: true, cpf_cnpj: '12.345.678/0001-99', valor: 150 }, contas);
ok('CNPJ + valor exato único', r1.tipo === 'unica' && r1.conta!.id === 'd');

// 3. Dois débitos iguais do mesmo fornecedor → pede escolha
const r2 = acharContaComprovante({ comprovante_pagamento: true, cpf_cnpj: '12345678000199', valor: 300 }, contas);
ok('valor duplicado → candidatas', r2.tipo === 'candidatas' && r2.candidatas!.length === 2);

// 4. Nome casa mesmo sem CNPJ no comprovante
ok('nome do fornecedor casa', nomeCasa('ARPEQ COM DE EQUIPAMENTOS', 'ARPEQ COM DE EQUIP LTDA ME') === true);
const r3 = acharContaComprovante({ comprovante_pagamento: true, fornecedor: 'ARPEQ COM DE EQUIPAMENTOS', valor: 479.78 }, contas);
ok('sem fornecedor comum → nenhuma', r3.tipo === 'nenhuma');

// 5. Valor divergente dentro da tolerância → candidata divergente
const r4 = acharContaComprovante({ comprovante_pagamento: true, cpf_cnpj: '99988877000155', fornecedor: 'SAO BRAZ', valor: 500 }, contas);
ok('valor próximo → candidata divergente', r4.tipo === 'candidatas' && r4.candidatas!.length === 1 && r4.candidatas![0].divergente === true);

// 6. Valor muito diferente → nada
const r5 = acharContaComprovante({ comprovante_pagamento: true, cpf_cnpj: '99988877000155', valor: 5000 }, contas);
ok('valor fora da tolerância → nenhuma', r5.tipo === 'nenhuma');

// 7. Comprovante sem valor → nada
const r6 = acharContaComprovante({ comprovante_pagamento: true, cpf_cnpj: '12345678000199', valor: null }, contas);
ok('sem valor → nenhuma', r6.tipo === 'nenhuma');

if (falhas) { console.error(`${falhas} teste(s) falharam`); Deno.exit(1); }
console.log('Todos os testes passaram.');

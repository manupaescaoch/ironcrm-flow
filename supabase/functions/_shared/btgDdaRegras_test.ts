import { boletoParaConta, DebitoBtg } from './btgDdaRegras.ts';
const d = { id: 'boleto-1', amount: 1234.56, dueDate: '2026-10-24', digitableLine: '20800000000000000000000000000000000000000004800', status: 'CREATED', payee: { taxId: '12345678000190', socialName: 'Fornecedor' } };
Deno.test('Importação DDA permanece pendente de conferência, nunca paga', () => {
  const c = boletoParaConta(d, 'unidade-1', '62952303000161');
  if (c.status !== 'pendente' || c.conferencia_status !== 'pendente_conferencia' || c.valor !== 1234.56) throw new Error('Baixa ou valor indevido');
});
Deno.test('Importação DDA mantém unidade e identidade estável para evitar repetição', () => {
  const a = boletoParaConta(d, 'unidade-1', '62952303000161');
  const b = boletoParaConta(d, 'unidade-1', '62952303000161');
  if (a.unidade_id !== 'unidade-1' || a.import_key !== b.import_key || a.btg_dda_id !== 'boleto-1') throw new Error('Identidade incorreta');
});
Deno.test('Boleto pago não cria uma nova conta pendente', () => {
  let recusou = false;
  try { boletoParaConta({ ...d, status: 'PAID' }, 'u', 'c'); } catch { recusou = true; }
  if (!recusou) throw new Error('Pagamento foi importado como cobrança');
});
Deno.test('Datas e valores inválidos não são importados', () => {
  if (DebitoBtg.safeParse({ ...d, dueDate: '2026-02-30' }).success || DebitoBtg.safeParse({ ...d, amount: -1 }).success) throw new Error('Dado inválido aceito');
});
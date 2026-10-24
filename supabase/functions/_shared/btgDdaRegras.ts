import { z } from 'npm:zod@3.25.76';

export const SCOPES_BTG = 'openid brn:btg:empresas:banking:direct-debit';
const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
export const DebitoBtg = z.object({
  id: z.string().min(1).max(200), amount: z.number().positive(), dueDate: dataISO,
  digitableLine: z.string().min(20).max(100), status: z.string(),
  payee: z.object({ taxId: z.string(), socialName: z.string().optional(), fantasyName: z.string().optional() }),
});
export type DebitoBtgTipo = z.infer<typeof DebitoBtg>;

export function boletoParaConta(d: DebitoBtgTipo, unidadeId: string, cnpj: string) {
  if (d.status !== 'CREATED') throw new Error('Boleto não está em aberto');
  const nome = (d.payee.socialName || d.payee.fantasyName || '').trim().toUpperCase();
  if (!nome) throw new Error('Boleto sem fornecedor');
  return {
    unidade_id: unidadeId, btg_dda_id: d.id, import_key: `btg-dda:${cnpj}:${d.id}`,
    descricao: nome, fornecedor: nome, fornecedor_documento: d.payee.taxId.replace(/\D/g, ''),
    valor: d.amount, data_vencimento: d.dueDate, linha_digitavel: d.digitableLine.replace(/\D/g, ''),
    status: 'pendente', conferencia_status: 'pendente_conferencia', forma_pagamento: 'boleto',
    pagador_cnpj: cnpj, origem: 'btg_dda', created_by_nome: 'IMPORTAÇÃO DDA BTG',
  };
}
// Regras puras do comprovante de pagamento enviado no grupo de Contas a Pagar.
// Um comprovante NUNCA cria conta nova: anexa a uma conta em aberto e dá baixa.

import { soDigitos } from './contasPagarTelegramRegras.ts';

export interface ContaComprovante {
  id: string;
  valor: number;
  fornecedor: string | null;
  fornecedor_documento: string | null;
  descricao: string | null;
  data_vencimento: string | null;
  status: string;
  linha_digitavel?: string | null;
  codigo_barras?: string | null;
}

export interface CandidataComprovante {
  conta: ContaComprovante;
  divergente: boolean;
}

export type ResultadoComprovante =
  | { tipo: 'unica'; conta: ContaComprovante }
  | { tipo: 'candidatas'; candidatas: CandidataComprovante[] }
  | { tipo: 'cancelada'; conta: ContaComprovante }
  | { tipo: 'nenhuma' };

const semAcento = (s: string) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const palavrasIgnoradas = new Set(['LTDA', 'ME', 'EIRELI', 'S.A.', 'SA', 'EPP', 'COM', 'DE', 'E']);

function tokens(s: string | null): string[] {
  return semAcento(s ?? '').split(/[^A-Z0-9]+/).filter((t) => t.length >= 3 && !palavrasIgnoradas.has(t));
}

/** Mesmo fornecedor pelo nome: 2 palavras em comum, ou uma palavra que é prefixo de outra (5+ letras). */
export function nomeCasa(a: string | null, b: string | null): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const comuns = ta.filter((t) => tb.includes(t));
  if (comuns.length >= 2) return true;
  return ta.some((t) => tb.some((s) => (s.startsWith(t) || t.startsWith(s)) && Math.min(s.length, t.length) >= 5));
}

/** É comprovante de pagamento? Só pela leitura da IA (flag); dado antigo sem a flag não é comprovante. */
export function ehComprovante(dados: any): boolean {
  return dados?.comprovante_pagamento === true;
}

/**
 * Procura a conta em aberto que o comprovante quita, na MESMA unidade.
 * 1) Mesmo fornecedor (CNPJ/CPF ou nome) e MESMO valor → única se houver só uma.
 * 2) Várias com mesmo valor → candidatas (botão escolhe).
 * 3) Nenhuma exata: mesmo fornecedor com valor próximo (≤20% ou R$ 50) → candidatas divergentes.
 */
export function acharContaComprovante(dados: any, contas: ContaComprovante[]): ResultadoComprovante {
  // 0) Mesmo boleto (linha digitável / código de barras) é a prova mais forte, mesmo com nome diferente.
  const linha = soDigitos(dados?.linha_digitavel) || soDigitos(dados?.codigo_barras);
  if (linha.length >= 40) {
    const mesmoBoleto = contas.filter((c) => [soDigitos(c.linha_digitavel), soDigitos(c.codigo_barras)].includes(linha));
    const aberta = mesmoBoleto.find((c) => c.status !== 'cancelada');
    if (aberta) return { tipo: 'unica', conta: aberta };
    if (mesmoBoleto.length) return { tipo: 'cancelada', conta: mesmoBoleto[0] };
  }
  const emAberto = contas.filter((c) => c.status !== 'cancelada');
  const forn = soDigitos(dados?.cpf_cnpj);
  const valor = typeof dados?.valor === 'number' ? dados.valor : null;

  const doFornecedor = emAberto.filter((c) =>
    (forn && soDigitos(c.fornecedor_documento) === forn) || (!forn && nomeCasa(dados?.fornecedor, c.fornecedor)),
  );
  // Fallback: CNPJ não bateu mas o nome casa com alguma conta
  const peloNome = forn ? emAberto.filter((c) => nomeCasa(dados?.fornecedor, c.fornecedor)) : doFornecedor;
  const candidatos = doFornecedor.length ? doFornecedor : peloNome;
  if (!candidatos.length || valor == null) return { tipo: 'nenhuma' };

  const exatos = candidatos.filter((c) => Math.abs(Number(c.valor) - valor) <= 0.01);
  if (exatos.length === 1) return { tipo: 'unica', conta: exatos[0] };
  if (exatos.length > 1) {
    return { tipo: 'candidatas', candidatas: exatos.map((conta) => ({ conta, divergente: false })) };
  }
  const tolerancia = Math.max(valor * 0.2, 50);
  const proximos = candidatos.filter((c) => Math.abs(Number(c.valor) - valor) <= tolerancia);
  if (proximos.length) {
    return { tipo: 'candidatas', candidatas: proximos.map((conta) => ({ conta, divergente: true })) };
  }
  return { tipo: 'nenhuma' };
}

const brl = (v: number | null | undefined) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (d: string | null | undefined) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '—');

const nomeConta = (c: ContaComprovante) => String(c.fornecedor || c.descricao || 'a conta').toUpperCase();

export function msgComprovanteProcessado(c: ContaComprovante, dados: any, nomeBaixa: string, quando: string): string {
  const pago = dados?.valor ?? c.valor;
  return [
    `✅ Pronto! Dei baixa na conta de ${nomeConta(c)}.`,
    '',
    `💰 ${brl(pago)}` + (Math.abs(Number(pago) - Number(c.valor)) > 0.01 ? ` (a conta era ${brl(c.valor)})` : '') +
      ` — pago em ${dataBr(dados?.data_emissao ?? null)}`,
    `👤 Baixa por ${nomeBaixa}, ${quando}`,
    '',
    'O comprovante ficou anexado na conta.',
  ].join('\n');
}

export function msgComprovanteEscolha(candidatas: CandidataComprovante[], dados: any): string {
  const linhas = candidatas.map((x, i) =>
    `${i + 1}. ${nomeConta(x.conta)} — ${brl(x.conta.valor)} — vence ${dataBr(x.conta.data_vencimento)}` +
    (x.divergente ? ' (valor diferente)' : ''));
  return [
    `🧾 Recebi o comprovante de ${brl(dados?.valor ?? null)}, mas achei mais de uma conta que pode ser dele:`,
    '',
    ...linhas,
    '',
    'Qual é a certa? Eu anexo e dou baixa.',
  ].join('\n');
}

export function msgComprovanteSemConta(dados: any): string {
  return [
    `🧾 Recebi o comprovante de ${String(dados?.fornecedor ?? '—').toUpperCase()} (${brl(dados?.valor ?? null)}, pago em ${dataBr(dados?.data_emissao ?? null)}).`,
    '',
    'Não achei nenhuma conta em aberto que combine com ele, então não mexi em nada.',
    'Se a conta ainda não está no CRM, manda a nota ou o boleto que eu lanço primeiro.',
  ].join('\n');
}

export function msgComprovanteCancelada(c: ContaComprovante): string {
  return [
    `🧾 Esse comprovante é do boleto de ${nomeConta(c)} (${brl(c.valor)}, venc. ${dataBr(c.data_vencimento)}).`,
    '',
    '⚠️ Só que essa conta está CANCELADA no CRM, então não dei baixa nem anexei.',
    'Se ela foi paga mesmo, reabra a conta no Contas a Pagar e mande o comprovante de novo.',
  ].join('\n');
}

export function msgComprovanteSemDados(): string {
  return '🧾 Recebi o comprovante, mas não consegui ler o fornecedor e o valor. Me diz de qual conta é, ou dá a baixa direto no CRM.';
}

export function msgComprovanteSemPermissao(c: ContaComprovante): string {
  return [
    `🧾 Anexei o comprovante na conta de ${nomeConta(c)} (${brl(c.valor)}, venc. ${dataBr(c.data_vencimento)}).`,
    '',
    '⚠️ Mas não dei baixa: quem mandou não tem o Telegram ligado ao CRM com acesso ao financeiro.',
    'Alguém autorizado pode tocar em PAGO na cobrança ou dar a baixa no CRM.',
  ].join('\n');
}

export function msgComprovanteJaPaga(c: ContaComprovante): string {
  return `🧾 A conta de ${nomeConta(c)} (${brl(c.valor)}) já estava paga. Só anexei o comprovante nela.`;
}

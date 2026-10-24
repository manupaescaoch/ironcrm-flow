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
}

export interface CandidataComprovante {
  conta: ContaComprovante;
  divergente: boolean;
}

export type ResultadoComprovante =
  | { tipo: 'unica'; conta: ContaComprovante }
  | { tipo: 'candidatas'; candidatas: CandidataComprovante[] }
  | { tipo: 'nenhuma' };

const semAcento = (s: string) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const palavrasIgnoradas = new Set(['LTDA', 'ME', 'EIRELI', 'S.A.', 'SA', 'EPP', 'COM', 'DE', 'E']);

function tokens(s: string): string[] {
  return semAcento(s).split(/[^A-Z0-9]+/).filter((t) => t.length >= 3 && !palavrasIgnoradas.has(t));
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

export function msgComprovanteProcessado(c: ContaComprovante, dados: any, nomeBaixa: string, quando: string): string {
  return [
    '✅ PAGAMENTO REGISTRADO COM COMPROVANTE', '',
    `Fornecedor: ${String(c.fornecedor || c.descricao || '').toUpperCase()}`,
    `Valor da conta: ${brl(c.valor)}`,
    `Valor pago: ${brl(dados?.valor ?? c.valor)}`,
    `Pago em: ${dataBr(dados?.data_emissao ?? null)}`,
    'Status da conta: Pago',
    'Conciliação bancária: Pendente',
    `Confirmado por: ${nomeBaixa} em ${quando}`, '',
    'Comprovante anexado à conta no CRM.',
  ].join('\n');
}

export function msgComprovanteEscolha(candidatas: CandidataComprovante[], dados: any): string {
  const linhas = candidatas.map((x, i) =>
    `${i + 1}. ${String(x.conta.fornecedor || x.conta.descricao || '').toUpperCase()} — ${brl(x.conta.valor)}` +
    ` — venc. ${dataBr(x.conta.data_vencimento)}${x.divergente ? ' (valor diferente do comprovante)' : ''}`);
  return [
    `🧾 Comprovante de pagamento recebido (${brl(dados?.valor ?? null)}).`,
    'Encontrei mais de uma conta possível. Toque na conta certa para anexar e dar baixa:',
    '',
    ...linhas,
  ].join('\n');
}

export function msgComprovanteSemConta(dados: any): string {
  return [
    '🧾 Comprovante de pagamento recebido.',
    'Não encontrei nenhuma conta em aberto que combine com ele, então nada foi alterado.',
    '',
    `Fornecedor: ${String(dados?.fornecedor ?? '—').toUpperCase()}`,
    `Valor pago: ${brl(dados?.valor ?? null)}`,
    `Data: ${dataBr(dados?.data_emissao ?? null)}`,
    '',
    'Se a conta ainda não existe no CRM, envie a nota ou o boleto dela para lançar primeiro.',
  ].join('\n');
}

export function msgComprovanteSemDados(): string {
  return [
    '🧾 Comprovante recebido, mas não consegui ler fornecedor e valor nele.',
    'Diga aqui no grupo a qual conta ele se refere, ou registre o pagamento no CRM.',
  ].join('\n');
}

export function msgComprovanteSemPermissao(c: ContaComprovante): string {
  return [
    '🧾 Comprovante anexado à conta:', '',
    `Fornecedor: ${String(c.fornecedor || c.descricao || '').toUpperCase()}`,
    `Valor: ${brl(c.valor)}`,
    `Vencimento: ${dataBr(c.data_vencimento)}`, '',
    '⚠️ Quem enviou não está vinculado ao CRM com acesso financeiro, então a baixa NÃO foi feita.',
    'Alguém autorizado pode clicar em PAGO na cobrança ou dar a baixa no CRM.',
  ].join('\n');
}

export function msgComprovanteJaPaga(c: ContaComprovante): string {
  return [
    '🧾 Comprovante recebido. A conta abaixo já estava paga:', '',
    `Fornecedor: ${String(c.fornecedor || c.descricao || '').toUpperCase()}`,
    `Valor: ${brl(c.valor)}`, '',
    'O comprovante foi anexado à conta no CRM.',
  ].join('\n');
}

import { CATEGORIAS, ContaFormaPagamento, ContaPrioridade } from '@/components/contas-pagar/constants';

export interface ParsedConta {
  descricao: string;
  fornecedor: string;
  categoria: string;
  prioridade: ContaPrioridade;
  valor: string;
  data_vencimento: string; // yyyy-mm-dd
  forma_pagamento: ContaFormaPagamento | '';
  chave_pix: string;
  codigo_pix: string;
  linha_digitavel: string;
  codigo_barras: string;
  numero_fatura: string;
  observacoes: string;
  unidadeMencionada: string | null;
}

/** Decodifica os campos do payload Pix (EMV TLV) sem alterar o código original. */
export function parsePixEmv(payload: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || Number.isNaN(len)) break;
    const value = payload.slice(i + 4, i + 4 + len);
    if (value.length < len) break;
    out[id] = value;
    i += 4 + len;
  }
  return out;
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function toIsoDate(day: string, month: string, year: string): string {
  let y = year;
  if (y.length === 2) y = `20${y}`;
  return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function findValor(text: string, emv: Record<string, string>): string {
  const patterns = [
    /(?:valor|total|vlr)\s*(?:total)?\s*[:\-]?\s*(?:r\$)?\s*([\d.]{1,15},\d{2})/i,
    /r\$\s*([\d.]{1,15},\d{2})/i,
    /(?:valor|total)\s*[:\-]?\s*(?:r\$)?\s*(\d+[.,]\d{2})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].replace(/\./g, '').replace(',', '.');
  }
  if (emv['54'] && /^\d+(\.\d{1,2})?$/.test(emv['54'])) return emv['54'];
  return '';
}

function findVencimento(text: string): string {
  const labelled = text.match(
    /(?:vencimento|vence(?:\s+em)?|venc\.?|pagamento\s+em|pagar\s+at[eé]|data\s+limite)\s*[:\-]?\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/i,
  );
  if (labelled) return toIsoDate(labelled[1], labelled[2], labelled[3]);
  const any = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (any) return toIsoDate(any[1], any[2], any[3]);
  return '';
}

function findLabelled(text: string, labels: string[]): string {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:\\-]\\s*([^\\n\\r]+)`, 'i');
    const m = text.match(re);
    if (m) {
      const value = normalizeSpaces(m[1]);
      if (value) return value;
    }
  }
  return '';
}

const CATEGORIA_KEYWORDS: { categoria: string; words: string[] }[] = [
  { categoria: 'Telefone', words: ['tim', 'vivo', 'claro', 'oi ', 'telefone', 'celular', 'telefonia'] },
  { categoria: 'Internet', words: ['internet', 'net ', 'fibra', 'link dedicado', 'wifi'] },
  { categoria: 'Energia', words: ['energia', 'neoenergia', 'celpe', 'luz', 'eletric'] },
  { categoria: 'Água', words: ['agua', 'água', 'compesa', 'saneamento'] },
  { categoria: 'Aluguel', words: ['aluguel', 'locacao', 'locação'] },
  { categoria: 'Condomínio', words: ['condominio', 'condomínio'] },
  { categoria: 'Impostos', words: ['imposto', 'das ', 'iss', 'irpj', 'darf', 'simples nacional'] },
  { categoria: 'Encargos', words: ['fgts', 'inss', 'encargo'] },
  { categoria: 'Folha de pagamento', words: ['folha', 'salario', 'salário', 'holerite'] },
  { categoria: 'Manutenção', words: ['manutencao', 'manutenção', 'reparo', 'consert'] },
  { categoria: 'Marketing', words: ['marketing', 'trafego', 'tráfego', 'anuncio', 'anúncio', 'meta ads', 'google ads'] },
  { categoria: 'Equipamentos', words: ['equipamento', 'halter', 'esteira', 'maquina', 'máquina'] },
  { categoria: 'Materiais', words: ['material', 'materiais', 'suprimento'] },
  { categoria: 'Serviços terceirizados', words: ['limpeza', 'seguranca', 'segurança', 'terceir', 'contabil'] },
  { categoria: 'Financiamentos', words: ['financiamento', 'emprestimo', 'empréstimo', 'parcela banco'] },
];

function guessCategoria(text: string): string {
  const lower = text.toLowerCase();
  for (const item of CATEGORIA_KEYWORDS) {
    if (item.words.some((w) => lower.includes(w))) return item.categoria;
  }
  return 'Outros';
}

function findPixPayload(text: string): string {
  const idx = text.indexOf('000201');
  if (idx === -1) return '';
  // Pega até o fim da linha, preservando exatamente os caracteres do código
  const rest = text.slice(idx);
  const lineEnd = rest.search(/[\n\r]/);
  const raw = (lineEnd === -1 ? rest : rest.slice(0, lineEnd)).trim();
  return raw.length >= 40 ? raw : '';
}

function findLinhaDigitavel(text: string): string {
  const candidates = text.match(/[\d][\d.\s]{45,60}\d/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, '');
    if (digits.length === 47 || digits.length === 48) return normalizeSpaces(candidate);
  }
  return '';
}

function findCodigoBarras(text: string): string {
  const matches = text.match(/\b\d{44}\b/g) || [];
  return matches[0] || '';
}

function findChavePix(text: string, pixPayload: string): string {
  const labelled = findLabelled(text, ['chave pix', 'chave']);
  if (labelled && !labelled.startsWith('000201')) return labelled;
  const pixLabel = findLabelled(text, ['pix']);
  if (pixLabel && !pixLabel.startsWith('000201') && pixLabel !== pixPayload) return pixLabel;
  return '';
}

function findFatura(text: string): string {
  const labelled = findLabelled(text, ['n[uú]mero da fatura', 'fatura', 'nota fiscal', 'nf', 'documento']);
  if (labelled) {
    const digits = labelled.match(/[\w.-]+/);
    if (digits) return digits[0];
  }
  const inline = text.match(/FAT\.?\s*([0-9]{4,})/i);
  if (inline) return inline[1];
  return '';
}

function findDescricao(text: string, fornecedor: string): string {
  const labelled = findLabelled(text, ['descri[cç][aã]o', 'refer[eê]ncia', 'conta']);
  if (labelled) return labelled;
  const lines = text
    .split(/[\n\r]/)
    .map((l) => normalizeSpaces(l))
    .filter((l) => l.length > 2 && !l.startsWith('000201'));
  const candidate = lines.find((l) => !/^\s*(r\$|valor|vencimento|pix|chave)/i.test(l));
  if (candidate) return candidate.slice(0, 120);
  return fornecedor ? `Conta ${fornecedor}` : '';
}

function findFornecedor(text: string, emv: Record<string, string>): string {
  const labelled = findLabelled(text, ['fornecedor', 'favorecido', 'benefici[aá]rio', 'empresa', 'cedente']);
  if (labelled) return labelled;
  if (emv['59']) return normalizeSpaces(emv['59']);
  return '';
}

/**
 * Interpreta um texto livre (WhatsApp, e-mail, etc.) e devolve os campos da conta.
 * O código Pix é preservado integralmente, sem alterar espaços ou sequência.
 */
export function parseContaTexto(rawText: string, unidadesNomes: string[] = []): ParsedConta {
  const text = rawText || '';
  const pixPayload = findPixPayload(text);
  const emv = pixPayload ? parsePixEmv(pixPayload) : {};

  const fornecedor = findFornecedor(text, emv);
  const descricao = findDescricao(text, fornecedor);
  const valor = findValor(text, emv);
  const data_vencimento = findVencimento(text);
  const linha_digitavel = findLinhaDigitavel(text);
  const codigo_barras = findCodigoBarras(text);
  const chave_pix = findChavePix(text, pixPayload);
  const numero_fatura = findFatura(text);
  const observacoes = findLabelled(text, ['observa[cç][oõ]es', 'obs']);

  let forma_pagamento: ContaFormaPagamento | '' = '';
  if (pixPayload || chave_pix || /\bpix\b/i.test(text)) forma_pagamento = 'pix';
  else if (linha_digitavel || codigo_barras || /boleto/i.test(text)) forma_pagamento = 'boleto';
  else if (/transfer|ted\b|doc\b/i.test(text)) forma_pagamento = 'transferencia';
  else if (/cart[aã]o/i.test(text)) forma_pagamento = 'cartao';
  else if (/d[eé]bito autom/i.test(text)) forma_pagamento = 'debito_automatico';
  else if (/dinheiro|esp[eé]cie/i.test(text)) forma_pagamento = 'dinheiro';

  const upper = text.toUpperCase();
  const unidadeMencionada =
    unidadesNomes.find((nome) => {
      const clean = nome.toUpperCase().replace(/^IRON\s+/, '').trim();
      return clean.length > 2 && upper.includes(clean);
    }) || null;

  const categoria = guessCategoria(`${descricao} ${fornecedor} ${text}`);

  return {
    descricao,
    fornecedor,
    categoria: CATEGORIAS.includes(categoria) ? categoria : 'Outros',
    prioridade: 'normal',
    valor,
    data_vencimento,
    forma_pagamento,
    chave_pix,
    codigo_pix: pixPayload,
    linha_digitavel,
    codigo_barras,
    numero_fatura,
    observacoes,
    unidadeMencionada,
  };
}

// Regras puras da edição/confirmação de documentos pelo Telegram (sem acesso ao banco).

export const soDig = (s: unknown) => String(s ?? '').replace(/\D/g, '');

/** "R$ 1.234,56", "350", "350.5" → número; inválido → null. */
export function parseValor(txt: string): number | null {
  let s = String(txt ?? '').replace(/r\$|\s/gi, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** "25/10/2026" ou "25/10/26" → "2026-10-25"; data inexistente → null. */
export function parseData(txt: string): string | null {
  const m = String(txt ?? '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], a = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const dt = new Date(Date.UTC(a, mo - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${a}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "10/2026" → "10/2026"; inválido → null. */
export function parseCompetencia(txt: string): string | null {
  const m = String(txt ?? '').trim().match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (!m || +m[1] < 1 || +m[1] > 12) return null;
  return `${m[1].padStart(2, '0')}/${m[2]}`;
}

export function cnpjValido(v: unknown): boolean {
  const c = soDig(v);
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r = base.split('').reduce((s, n, i) => s + +n * pesos[i], 0) % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(c.slice(0, 12)) === +c[12] && dv(c.slice(0, 13)) === +c[13];
}

export function cpfValido(v: unknown): boolean {
  const c = soDig(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n: number) => {
    const r = (c.slice(0, n).split('').reduce((s, x, i) => s + +x * (n + 1 - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === +c[9] && dv(10) === +c[10];
}

export const documentoFornecedorValido = (v: unknown) => cnpjValido(v) || cpfValido(v);

/** Normaliza nome para comparar fornecedores ("Arpeq Com. de Equip Ltda - ME" ≈ "ARPEQ COM DE EQUIP LTDA ME"). */
export function nomeNormalizado(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(LTDA|ME|EPP|EIRELI|S ?A|MEI)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Campos editáveis por texto (u = unidade e k = categoria usam botões). */
export const CAMPOS: Record<string, { coluna: string; rotulo: string; pergunta: string }> = {
  u: { coluna: 'unidade_id', rotulo: 'Unidade', pergunta: '' },
  f: { coluna: 'fornecedor', rotulo: 'Fornecedor', pergunta: 'Informe o nome do fornecedor.' },
  j: { coluna: 'fornecedor_documento', rotulo: 'CNPJ do fornecedor', pergunta: 'Informe o CNPJ (ou CPF) do fornecedor.' },
  d: { coluna: 'descricao', rotulo: 'Descrição', pergunta: 'Informe a nova descrição da despesa.' },
  k: { coluna: 'categoria', rotulo: 'Categoria', pergunta: '' },
  v: { coluna: 'valor', rotulo: 'Valor', pergunta: 'Informe o novo valor da despesa. Ex.: R$ 350,00' },
  t: { coluna: 'data_vencimento', rotulo: 'Vencimento', pergunta: 'Informe a nova data de vencimento. Ex.: 30/10/2026' },
  c: { coluna: 'competencia', rotulo: 'Competência', pergunta: 'Informe a competência (mês/ano). Ex.: 10/2026' },
  l: { coluna: 'linha_digitavel', rotulo: 'Linha digitável', pergunta: 'Informe a linha digitável do boleto (só números ou com pontos).' },
};

/** Converte a resposta do usuário no valor da coluna; erro → { erro }. */
export function interpretarCampo(campo: string, texto: string): { valor: unknown } | { erro: string } {
  const t = String(texto ?? '').trim();
  if (!t) return { erro: 'Resposta vazia.' };
  switch (campo) {
    case 'f': case 'd': return t.length > 200 ? { erro: 'Texto muito longo.' } : { valor: t.toUpperCase() };
    case 'j': return documentoFornecedorValido(t) ? { valor: soDig(t) } : { erro: 'CNPJ/CPF inválido. Confira os números.' };
    case 'v': { const n = parseValor(t); return n == null ? { erro: 'Valor inválido. Ex.: R$ 350,00' } : { valor: n }; }
    case 't': { const d = parseData(t); return d ? { valor: d } : { erro: 'Data inválida. Use dd/mm/aaaa.' }; }
    case 'c': { const c = parseCompetencia(t); return c ? { valor: c } : { erro: 'Competência inválida. Use mm/aaaa.' }; }
    case 'l': { const l = soDig(t); return l.length === 47 || l.length === 48 ? { valor: l } : { erro: 'A linha digitável deve ter 47 ou 48 números.' }; }
    default: return { erro: 'Campo desconhecido.' };
  }
}

export const NOME_TOKEN = '[nome]';

/** Substitui [nome] / {nome} / [NOME] pelo primeiro nome informado. */
export function aplicarPlaceholders(texto: string, nomeCompleto?: string | null): string {
  const primeiro = (nomeCompleto || '').trim().split(/\s+/)[0] || '';
  if (!texto) return texto;
  return texto.replace(/[\[{]\s*nome\s*[\]}]/gi, primeiro);
}

/** Insere um token na posição do cursor de um textarea. */
export function inserirToken(
  el: HTMLTextAreaElement | null,
  valor: string,
  token: string,
  setValor: (v: string) => void,
) {
  if (!el) {
    setValor(valor + token);
    return;
  }
  const start = el.selectionStart ?? valor.length;
  const end = el.selectionEnd ?? start;
  const novo = valor.slice(0, start) + token + valor.slice(end);
  setValor(novo);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  });
}

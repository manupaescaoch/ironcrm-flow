export const NOME_TOKEN = '[NOME]';

const NOME_REGEX = /[[{]\s*nome\s*[\]}]/gi;

/** Verifica se o texto contém a variável [NOME] (em qualquer capitalização). */
export function contemNomeToken(texto?: string | null): boolean {
  if (!texto) return false;
  return new RegExp(NOME_REGEX.source, 'i').test(texto);
}

/** Retorna o primeiro nome capitalizado (JOSA MARIA -> Josa). */
export function primeiroNomeCapitalizado(nomeCompleto?: string | null): string {
  const primeiro = (nomeCompleto || '').trim().split(/\s+/)[0] || '';
  if (!primeiro) return '';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

/** Substitui [NOME] / [nome] / {nome} pelo primeiro nome capitalizado. */
export function aplicarPlaceholders(texto: string, nomeCompleto?: string | null): string {
  if (!texto) return texto;
  return texto.replace(NOME_REGEX, primeiroNomeCapitalizado(nomeCompleto));
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

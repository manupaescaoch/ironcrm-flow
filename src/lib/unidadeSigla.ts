/**
 * Siglas oficiais das unidades (3 letras).
 * EVO BOA VIAGEM -> EBV | EVO MADALENA -> EMD | EVO SETÚBAL -> EST
 */
const SIGLAS: Record<string, string> = {
  'BOA VIAGEM': 'EBV',
  MADALENA: 'EMD',
  SETUBAL: 'EST',
};

function normalizar(nome: string) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^(EVO|IRON)\s+/, '')
    .trim();
}

export function getUnidadeSigla(nome?: string | null): string {
  if (!nome) return '--';
  const base = normalizar(nome);
  if (SIGLAS[base]) return SIGLAS[base];
  const palavras = base.split(/\s+/).filter(Boolean);
  if (palavras.length > 1) {
    return ('E' + palavras.map((p) => p[0]).join('')).slice(0, 3);
  }
  return ('E' + base.slice(0, 2)).toUpperCase();
}

/**
 * Padronização canônica de telefone (espelha public.canonical_phone no banco).
 * - remove máscara / caracteres não numéricos
 * - remove prefixo internacional 55
 * - completa o 9 do celular quando ausente
 */
export function canonicalPhone(phone?: string | null): string {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if (!d) return '';

  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) {
    d = d.slice(2);
  }

  if (d.length === 10 && ['6', '7', '8', '9'].includes(d[2])) {
    d = `${d.slice(0, 2)}9${d.slice(2)}`;
  }

  return d;
}

export type EtapaTecnica = 'M+7' | 'M+21';
export type StatusTecnico = 'pendente' | 'em_andamento' | 'concluido' | 'dispensado' | 'cancelado';
export type RegistroTecnico = {
  data: string;
  coordenador: string;
  canal: 'presencial' | 'whatsapp';
  observacoes: string;
  dificuldades: string;
  ajustes: string;
  encaminhamentos: string;
}
export const STATUS_TECNICOS: { value: StatusTecnico; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'dispensado', label: 'Dispensado' },
  { value: 'cancelado', label: 'Cancelado' },
];
export function telefoneTecnico(raw: string | null | undefined): string | null {
  let digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(digits)) return null;
  return digits;
}
function nomeProprio(raw: string): string {
  return raw.toLocaleLowerCase('pt-BR').replace(/(^|\s)\p{L}/gu, char => char.toLocaleUpperCase('pt-BR'));
}
export function mensagemTecnica(etapa: EtapaTecnica, nome: string, unidade: string, coordenador?: string | null): string {
  const primeiro = nomeProprio(nome.trim().split(/\s+/)[0] || '[NOME]');
  const local = nomeProprio(unidade.replace(/^EVO\s+/i, '').trim());
  const responsavel = coordenador?.trim() && coordenador !== '[COORDENADOR]' ? nomeProprio(coordenador.trim()) : '[COORDENADOR]';
  return etapa === 'M+7'
    ? `Oi, ${primeiro}! Aqui é ${responsavel}, da EVO ${local}.\n\nComo está sua adaptação aos treinos? Alguma dificuldade com os exercícios?`
    : `Oi, ${primeiro}! Aqui é ${responsavel}, da EVO ${local}.\n\nComo estão os treinos? Já percebe alguma evolução ou tem algo que podemos ajustar?`;
}
export function linkTecnico(telefone: string | null | undefined, mensagem: string): string | null {
  const numero = telefoneTecnico(telefone);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}` : null;
}
export function prazoTecnico(inicio: string, etapa: EtapaTecnica): string {
  const [ano, mes, dia] = inicio.split('-').map(Number);
  const date = new Date(ano, mes - 1, dia);
  date.setDate(date.getDate() + (etapa === 'M+7' ? 7 : 21));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function etapaElegivel(inicio: string, hoje: string, etapa: EtapaTecnica, ativo: boolean, matriculado: boolean): boolean {
  return ativo && matriculado && prazoTecnico(inicio, etapa) <= hoje;
}
export function registroTecnicoValido(status: StatusTecnico, registro: Partial<RegistroTecnico>): boolean {
  if (status === 'pendente' || status === 'em_andamento') return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(registro.data ?? '') && !!registro.coordenador?.trim()
    && ['presencial', 'whatsapp'].includes(registro.canal ?? '') && !!registro.observacoes?.trim();
}
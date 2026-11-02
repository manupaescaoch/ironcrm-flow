import { linkTecnico, STATUS_TECNICOS, type StatusTecnico } from './fuTecnico';
export { STATUS_TECNICOS as STATUS_GERENCIAIS, linkTecnico as linkGerencial };
export type StatusGerencial = StatusTecnico;
export type RegistroGerencial = { data: string; gerente: string; canal: 'presencial' | 'whatsapp'; percepcao: string; reclamacoes: string; melhorias: string; providencias: string };
export const registroGerencialVazio: RegistroGerencial = { data: '', gerente: '', canal: 'presencial', percepcao: '', reclamacoes: '', melhorias: '', providencias: '' };
export function mensagemGerencial(nome: string, unidade: string, gerente?: string | null) {
  const proper = (s: string) => s.toLocaleLowerCase('pt-BR').replace(/(^|\s)\p{L}/gu, c => c.toLocaleUpperCase('pt-BR'));
  return `Oi, ${proper(nome.trim().split(/\s+/)[0] || '[NOME]')}! Tudo bem?\n\nAqui é ${gerente && gerente !== '[GERENTE]' ? proper(gerente) : '[GERENTE]'}, gerente da EVO ${proper(unidade.replace(/^EVO\s+/i, ''))}.\n\nVocê completou seu primeiro mês com a gente e queria aproveitar para saber como está sendo sua experiência.\n\nComo você avalia nosso atendimento, o acompanhamento dos treinadores e a estrutura da unidade?\n\nSua opinião é muito importante para continuarmos melhorando. 💙`;
}
export function registroGerencialValido(status: StatusGerencial, r: Partial<RegistroGerencial>) {
  return ['pendente', 'em_andamento'].includes(status) || (/^\d{4}-\d{2}-\d{2}$/.test(r.data ?? '') && !!r.gerente?.trim() && ['presencial', 'whatsapp'].includes(r.canal ?? '') && !!r.percepcao?.trim());
}
export function prazoGerencial(inicio: string) {
  const [a, m, d] = inicio.split('-').map(Number); const date = new Date(a, m - 1, d);
  date.setDate(date.getDate() + 30);
  while ([0, 6].includes(date.getDay())) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function elegivelGerencial(inicio: string, hoje: string, ativo: boolean, matriculado: boolean) {
  return ativo && matriculado && prazoGerencial(inicio) <= hoje;
}
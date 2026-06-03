// Mapeamentos de display para o funil (mantém enum DB intacto).
import type { StatusFunil } from '@/types/database';

export const UNIDADE_NAO_DEFINIDA_ID = '00000000-0000-0000-0000-000000000000';

export const STATUS_FUNIL_LABEL: Record<StatusFunil, string> = {
  novo: 'Novo lead',
  contato_inicial: 'Em atendimento',
  aula_agendada: 'Agendado',
  aula_realizada: 'Compareceu',
  follow_up: 'Em atendimento',
  negociacao: 'Negociação',
  convertido: 'Matriculado',
  perdido: 'Perdido',
};

export const STATUS_FUNIL_BADGE: Record<StatusFunil, string> = {
  novo: 'bg-blue-500/10 text-blue-700 border-blue-200',
  contato_inicial: 'bg-sky-500/10 text-sky-700 border-sky-200',
  aula_agendada: 'bg-amber-500/10 text-amber-700 border-amber-200',
  aula_realizada: 'bg-orange-500/10 text-orange-700 border-orange-200',
  follow_up: 'bg-indigo-500/10 text-indigo-700 border-indigo-200',
  negociacao: 'bg-cyan-500/10 text-cyan-700 border-cyan-200',
  convertido: 'bg-green-500/10 text-green-700 border-green-200',
  perdido: 'bg-red-500/10 text-red-700 border-red-200',
};

export type StatusConversa =
  | 'aguardando_resposta'
  | 'respondido'
  | 'em_andamento'
  | 'urgente'
  | 'encerrado';

export const STATUS_CONVERSA_LABEL: Record<StatusConversa, string> = {
  aguardando_resposta: 'Aguardando resposta',
  respondido: 'Respondido',
  em_andamento: 'Em andamento',
  urgente: 'Urgente',
  encerrado: 'Encerrado',
};

export const STATUS_CONVERSA_BADGE: Record<StatusConversa, string> = {
  aguardando_resposta: 'bg-amber-500/10 text-amber-700 border-amber-200',
  respondido: 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  em_andamento: 'bg-blue-500/10 text-blue-700 border-blue-200',
  urgente: 'bg-red-500/10 text-red-700 border-red-200',
  encerrado: 'bg-zinc-500/10 text-zinc-700 border-zinc-200',
};

export const STATUS_PIPELINE: StatusFunil[] = [
  'novo',
  'aula_agendada',
  'aula_realizada',
  'follow_up',
  'negociacao',
];

export function normalizarTelefone(p: string | null | undefined): string {
  return (p ?? '').replace(/\D/g, '');
}

export function isNaoDefinida(unidadeId: string | null | undefined) {
  return unidadeId === UNIDADE_NAO_DEFINIDA_ID;
}

import { Lead, Interacao } from '@/types/database';

// Interfaces
export interface Stats {
  total: number;
  novos: number;
  aulasAgendadas: number;
}

export interface PeriodStats {
  experimentaisPeriodo: number;
  comparecimentosPeriodo: number;
  matriculasPeriodo: number;
  conversaoMesmoDia: number;
}

export interface MatriculaItem {
  lead: Lead;
  interacao: Interacao;
}

// Status Labels and Colors
export const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  contato_inicial: 'Contato Inicial',
  aula_agendada: 'Experimental Agendada',
  aula_realizada: 'Experimental Realizada',
  negociacao: 'Negociação',
  convertido: 'Convertido',
  perdido: 'Perdido',
  follow_up: 'Follow Up',
};

export const STATUS_COLORS: Record<string, string> = {
  novo: 'bg-blue-100 text-blue-700',
  contato_inicial: 'bg-purple-100 text-purple-700',
  aula_agendada: 'bg-amber-100 text-amber-700',
  aula_realizada: 'bg-orange-100 text-orange-700',
  negociacao: 'bg-cyan-100 text-cyan-700',
  convertido: 'bg-green-100 text-green-700',
  perdido: 'bg-red-100 text-red-700',
  follow_up: 'bg-indigo-100 text-indigo-700',
};

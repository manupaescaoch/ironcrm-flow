import { Lead, Interacao } from '@/types/database';

// ==================== INTERFACES ====================
export interface TopCards {
  leadsDoMes: number;
  agendamentos: number;
  comparecimentos: number;
  matriculas: number;
  taxaConversao: number;
  taxaLeadAtendimento: number;
  faturamentoTotal: number;
  ticketMedio: number;
  ltv: number;
}

export interface FunilItem {
  etapa: string;
  quantidade: number;
  conversao: number | null;
}

export interface OrigemItem {
  origem: string;
  leads: number;
  matriculas: number;
  conversao: number;
}

export interface AgendaPresencaRow {
  data: string;
  agendados: number;
  compareceram: number;
  noShow: number;
}

export interface AgendaPresencaData {
  rows: AgendaPresencaRow[];
  mediaNoShow: number;
  melhorDia: AgendaPresencaRow | null;
  piorDia: AgendaPresencaRow | null;
}

export interface CadastradorItem {
  cadastrador: string;
  leads: number;
  agendamentos: number;
  matriculas: number;
  conversao: number;
}

export interface FechadorItem {
  fechador: string;
  atendimentos: number;
  comparecimentos: number;
  matriculas: number;
  valorTotal: number;
  conversao: number;
}

export interface TreinadorItem {
  treinador: string;
  aulas: number;
  matriculas: number;
  conversao: number;
  bonusPorAluno: number;
  bonusTotal: number;
}

export interface ResumoFinal {
  totalLeads: number;
  totalAgendamentos: number;
  totalComparecimentos: number;
  totalMatriculas: number;
  conversaoGeral: number;
  mediaNoShow: number;
  melhorCadastrador: string;
  melhorFechador: string;
  melhorTreinador: string;
}

// ==================== CHART COLORS ====================
export const CHART_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

// Types
export interface InteracaoComLead {
  id: string;
  lead_id: string;
  lead_nome?: string;
  lead_cadastrado_por?: string;
  responsavel_fechamento: string | null;
  treinador_responsavel: string | null;
  valor_plano: number | null;
  plano_escolhido: string | null;
  comissao_comercial: number | null;
  comissao_recepcao: number | null;
  data_fechamento: string | null;
  fechou_matricula: boolean | null;
  compareceu: boolean | null;
}

export interface ComissaoAgrupada {
  responsavel: string;
  matriculas: number;
  comissao: number;
}

export interface TreinadorBonus {
  treinador: string;
  aulas: number;
  matriculas: number;
  faturamento: number;
  conversao: number;
  bonusPorAluno: number;
  bonusTotal: number;
}

export interface ComissaoStats {
  totalMatriculas: number;
  ticketMedio: number;
  totalComissaoCadastrador: number;
  totalComissaoFechador: number;
}

export interface TreinadorStats {
  totalMatriculas: number;
  totalBonus: number;
}

// Constants
export const MESES = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

export const CURRENT_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

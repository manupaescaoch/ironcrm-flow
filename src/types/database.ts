export type PlanoEscolhido = 
  | 'Executivo Mensal'
  | 'Mensal'
  | 'Trimestral'
  | 'Semestral'
  | 'Anual'
  | 'Executivo Anual';

export type StatusFunil = 
  | 'novo'
  | 'contato_inicial'
  | 'aula_agendada'
  | 'aula_realizada'
  | 'negociacao'
  | 'convertido'
  | 'perdido';

export interface Lead {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string | null;
  status_funil: StatusFunil;
  plano_escolhido: PlanoEscolhido | null;
  data_aula_experimental: string | null;
  observacoes: string | null;
  atendido_por: string | null;
  ativo: boolean;
  user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interacao {
  id: string;
  lead_id: string;
  tipo: string;
  descricao: string | null;
  data_interacao: string;
  created_at: string;
  atendido_por: string | null;
  atendido_por_tipo: string | null;
  agendou_experimental: boolean;
  data_experimental: string | null;
  hora_experimental: string | null;
  compareceu: boolean;
  reagendou: boolean;
  fechou_matricula: boolean;
  plano_escolhido: string | null;
  valor_plano: number;
  comissao_comercial: number;
  comissao_recepcao: number;
  data_fechamento: string | null;
  responsavel_fechamento: string | null;
  treinador_responsavel: string | null;
  treinador_experimental: string | null;
  origem_fechamento: string | null;
  quem_agendou: string | null;
  tipo_atendimento: string | null;
}

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: Lead;
        Insert: Omit<Lead, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>;
      };
      interacoes: {
        Row: Interacao;
        Insert: Omit<Interacao, 'id' | 'created_at'> & { id?: string };
        Update: Partial<Omit<Interacao, 'id' | 'created_at'>>;
      };
    };
  };
}

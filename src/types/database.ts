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
  | 'perdido'
  | 'follow_up';

export interface Lead {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string | null;
  status_funil: StatusFunil;
  plano_escolhido: PlanoEscolhido | null;
  data_aula_experimental: string | null;
  hora_aula_experimental: string | null;
  treinador_experimental?: string | null;
  observacoes: string | null;
  atendido_por: string | null;
  cadastrado_por: string | null;
  ativo: boolean;
  user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Follow-up fields
  follow_up_whatsapp_enviado: boolean;
  follow_up_enviado_em: string | null;
  follow_up_responsavel: string | null;
  // Motivo de perda fields
  motivo_perda: string | null;
  data_perda: string | null;
  // Matricula status (security field)
  is_matriculado: boolean;
  // Nível de interesse manual
  nivel_interesse?: 'alto' | 'medio' | 'baixo' | null;
  nivel_interesse_atualizado_em?: string | null;
  nivel_interesse_atualizado_por?: string | null;
}


export type StatusAvaliacao = 'agendada' | 'realizada' | 'faltou' | 'reagendada';

export interface Interacao {
  id: string;
  lead_id: string;
  tipo: string;
  descricao: string | null;
  data_interacao: string;
  created_at: string;
  created_by: string | null;
  atendido_por: string | null;
  atendido_por_tipo: string | null;
  agendou_experimental: boolean;
  data_experimental: string | null;
  hora_experimental: string | null;
  compareceu: boolean | null;
  confirmado: boolean | null;
  reagendou: boolean;
  fechou_matricula: boolean;
  plano_escolhido: string | null;
  valor_plano: number;
  comissao_comercial: number;
  comissao_recepcao: number;
  comissao_cadastrador: number;
  cadastrado_por: string | null;
  data_fechamento: string | null;
  responsavel_fechamento: string | null;
  treinador_responsavel: string | null;
  treinador_experimental: string | null;
  origem_fechamento: string | null;
  quem_agendou: string | null;
  tipo_atendimento: string | null;
  // Avaliação Física fields
  data_avaliacao: string | null;
  hora_avaliacao: string | null;
  status_avaliacao: StatusAvaliacao | null;
  agendado_evo?: boolean | null;
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

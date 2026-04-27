export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cronograma_atividades: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number | null
          formulario_id: string | null
          horario: string | null
          id: string
          mensagem: string | null
          responsavel_id: string | null
          titulo: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number | null
          formulario_id?: string | null
          horario?: string | null
          id?: string
          mensagem?: string | null
          responsavel_id?: string | null
          titulo: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number | null
          formulario_id?: string | null
          horario?: string | null
          id?: string
          mensagem?: string | null
          responsavel_id?: string | null
          titulo?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_atividades_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_atividades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "cronograma_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_atividades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_envios: {
        Row: {
          atividade_id: string | null
          created_at: string
          enviado_em: string | null
          formulario_id: string | null
          funcionario_id: string
          id: string
          respondido_em: string | null
          resposta_id: string | null
          status: string
          unidade_id: string
        }
        Insert: {
          atividade_id?: string | null
          created_at?: string
          enviado_em?: string | null
          formulario_id?: string | null
          funcionario_id: string
          id?: string
          respondido_em?: string | null
          resposta_id?: string | null
          status?: string
          unidade_id: string
        }
        Update: {
          atividade_id?: string | null
          created_at?: string
          enviado_em?: string | null
          formulario_id?: string | null
          funcionario_id?: string
          id?: string
          respondido_em?: string | null
          resposta_id?: string | null
          status?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_envios_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "cronograma_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_envios_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_envios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "cronograma_funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_envios_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "formulario_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_envios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_funcionarios: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          setor: string
          telefone: string | null
          turno: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          setor?: string
          telefone?: string | null
          turno?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          setor?: string
          telefone?: string | null
          turno?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_funcionarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      escala: {
        Row: {
          ano: number
          created_at: string
          created_by: string | null
          feriado: boolean
          final_de_semana: string
          id: string
          mes: number
          observacoes: string | null
          recepcao: string | null
          seguranca: string | null
          servicos_gerais: string | null
          treinador: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          created_by?: string | null
          feriado?: boolean
          final_de_semana: string
          id?: string
          mes: number
          observacoes?: string | null
          recepcao?: string | null
          seguranca?: string | null
          servicos_gerais?: string | null
          treinador?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          created_by?: string | null
          feriado?: boolean
          final_de_semana?: string
          id?: string
          mes?: number
          observacoes?: string | null
          recepcao?: string | null
          seguranca?: string | null
          servicos_gerais?: string | null
          treinador?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escala_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_interno: {
        Row: {
          created_at: string
          id: string
          insumo_id: string
          quantidade_atual: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insumo_id: string
          quantidade_atual?: number
          unidade_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insumo_id?: string
          quantidade_atual?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_interno_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: true
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_interno_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          cancelado_motivo: string | null
          concluido_em: string | null
          concluido_por: string | null
          created_at: string
          data_prevista: string
          data_referencia: string
          id: string
          lead_id: string
          status: string
          tipo: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          cancelado_motivo?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          data_prevista: string
          data_referencia: string
          id?: string
          lead_id: string
          status?: string
          tipo: string
          unidade_id?: string
          updated_at?: string
        }
        Update: {
          cancelado_motivo?: string | null
          concluido_em?: string | null
          concluido_por?: string | null
          created_at?: string
          data_prevista?: string
          data_referencia?: string
          id?: string
          lead_id?: string
          status?: string
          tipo?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_campos: {
        Row: {
          created_at: string
          formulario_id: string
          id: string
          label: string
          obrigatorio: boolean
          opcoes: Json | null
          ordem: number
          tipo: string
        }
        Insert: {
          created_at?: string
          formulario_id: string
          id?: string
          label: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          tipo?: string
        }
        Update: {
          created_at?: string
          formulario_id?: string
          id?: string
          label?: string
          obrigatorio?: boolean
          opcoes?: Json | null
          ordem?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulario_campos_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_respostas: {
        Row: {
          created_at: string
          enviado_grupo: boolean
          formulario_id: string
          id: string
          respondido_por_nome: string
          respondido_por_telefone: string | null
          respostas: Json
          unidade_id: string
        }
        Insert: {
          created_at?: string
          enviado_grupo?: boolean
          formulario_id: string
          id?: string
          respondido_por_nome: string
          respondido_por_telefone?: string | null
          respostas?: Json
          unidade_id: string
        }
        Update: {
          created_at?: string
          enviado_grupo?: boolean
          formulario_id?: string
          id?: string
          respondido_por_nome?: string
          respondido_por_telefone?: string | null
          respostas?: Json
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulario_respostas_formulario_id_fkey"
            columns: ["formulario_id"]
            isOneToOne: false
            referencedRelation: "formularios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_respostas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      formularios: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          setor: string
          titulo: string
          turno: string
          unidade_id: string
          updated_at: string
          whatsapp_grupo: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          setor?: string
          titulo: string
          turno?: string
          unidade_id: string
          updated_at?: string
          whatsapp_grupo?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          setor?: string
          titulo?: string
          turno?: string
          unidade_id?: string
          updated_at?: string
          whatsapp_grupo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "formularios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          lead_time_dias: number
          nome: string
          observacoes: string | null
          telefone: string | null
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          lead_time_dias?: number
          nome: string
          observacoes?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          lead_time_dias?: number
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      insumos: {
        Row: {
          ativo: boolean
          categoria: string
          codigo_insumo: string
          created_at: string
          custo_unitario: number
          estoque_seguranca_dias: number
          fornecedor_id: string | null
          fornecedor_padrao: string | null
          id: string
          lead_time_dias: number
          media_diaria_manual: number | null
          nome_insumo: string
          quantidade_minima: number
          quantidade_minima_compra: number
          unidade_id: string | null
          unidade_medida: string
          updated_at: string
          usar_media_manual: boolean
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo_insumo: string
          created_at?: string
          custo_unitario?: number
          estoque_seguranca_dias?: number
          fornecedor_id?: string | null
          fornecedor_padrao?: string | null
          id?: string
          lead_time_dias?: number
          media_diaria_manual?: number | null
          nome_insumo: string
          quantidade_minima?: number
          quantidade_minima_compra?: number
          unidade_id?: string | null
          unidade_medida: string
          updated_at?: string
          usar_media_manual?: boolean
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo_insumo?: string
          created_at?: string
          custo_unitario?: number
          estoque_seguranca_dias?: number
          fornecedor_id?: string | null
          fornecedor_padrao?: string | null
          id?: string
          lead_time_dias?: number
          media_diaria_manual?: number | null
          nome_insumo?: string
          quantidade_minima?: number
          quantidade_minima_compra?: number
          unidade_id?: string | null
          unidade_medida?: string
          updated_at?: string
          usar_media_manual?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "insumos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insumos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      interacoes: {
        Row: {
          agendou_experimental: boolean | null
          atendido_por: string | null
          atendido_por_tipo: string | null
          boas_vindas_enviada_em: string | null
          cadastrado_por: string | null
          comissao_cadastrador: number | null
          comissao_comercial: number | null
          comissao_recepcao: number | null
          compareceu: boolean | null
          confirmado: boolean | null
          created_at: string
          created_by: string | null
          data_avaliacao: string | null
          data_experimental: string | null
          data_fechamento: string | null
          data_interacao: string
          data_vencimento: string | null
          descricao: string | null
          fechou_matricula: boolean | null
          feedback_pos_aula_enviado_em: string | null
          hora_avaliacao: string | null
          hora_experimental: string | null
          id: string
          lead_id: string
          origem_fechamento: string | null
          plano_escolhido: string | null
          quem_agendou: string | null
          quem_indicou: string | null
          reagendou: boolean | null
          responsavel_fechamento: string | null
          status_avaliacao: string | null
          tipo: string
          tipo_atendimento: string | null
          treinador_experimental: string | null
          treinador_responsavel: string | null
          unidade_id: string
          valor_plano: number | null
        }
        Insert: {
          agendou_experimental?: boolean | null
          atendido_por?: string | null
          atendido_por_tipo?: string | null
          boas_vindas_enviada_em?: string | null
          cadastrado_por?: string | null
          comissao_cadastrador?: number | null
          comissao_comercial?: number | null
          comissao_recepcao?: number | null
          compareceu?: boolean | null
          confirmado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_experimental?: string | null
          data_fechamento?: string | null
          data_interacao?: string
          data_vencimento?: string | null
          descricao?: string | null
          fechou_matricula?: boolean | null
          feedback_pos_aula_enviado_em?: string | null
          hora_avaliacao?: string | null
          hora_experimental?: string | null
          id?: string
          lead_id: string
          origem_fechamento?: string | null
          plano_escolhido?: string | null
          quem_agendou?: string | null
          quem_indicou?: string | null
          reagendou?: boolean | null
          responsavel_fechamento?: string | null
          status_avaliacao?: string | null
          tipo: string
          tipo_atendimento?: string | null
          treinador_experimental?: string | null
          treinador_responsavel?: string | null
          unidade_id?: string
          valor_plano?: number | null
        }
        Update: {
          agendou_experimental?: boolean | null
          atendido_por?: string | null
          atendido_por_tipo?: string | null
          boas_vindas_enviada_em?: string | null
          cadastrado_por?: string | null
          comissao_cadastrador?: number | null
          comissao_comercial?: number | null
          comissao_recepcao?: number | null
          compareceu?: boolean | null
          confirmado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_experimental?: string | null
          data_fechamento?: string | null
          data_interacao?: string
          data_vencimento?: string | null
          descricao?: string | null
          fechou_matricula?: boolean | null
          feedback_pos_aula_enviado_em?: string | null
          hora_avaliacao?: string | null
          hora_experimental?: string | null
          id?: string
          lead_id?: string
          origem_fechamento?: string | null
          plano_escolhido?: string | null
          quem_agendou?: string | null
          quem_indicou?: string | null
          reagendou?: boolean | null
          responsavel_fechamento?: string | null
          status_avaliacao?: string | null
          tipo?: string
          tipo_atendimento?: string | null
          treinador_experimental?: string | null
          treinador_responsavel?: string | null
          unidade_id?: string
          valor_plano?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      investimentos_marketing: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          id: string
          observacoes: string | null
          unidade_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          observacoes?: string | null
          unidade_id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          observacoes?: string | null
          unidade_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          atendido_por: string | null
          ativo: boolean
          cadastrado_por: string | null
          created_at: string
          created_by: string | null
          data_aula_experimental: string | null
          data_perda: string | null
          email: string | null
          follow_up_enviado_em: string | null
          follow_up_responsavel: string | null
          follow_up_whatsapp_enviado: boolean | null
          hora_aula_experimental: string | null
          id: string
          is_matriculado: boolean
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          plano_escolhido: string | null
          status_funil: string
          telefone: string | null
          unidade_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          atendido_por?: string | null
          ativo?: boolean
          cadastrado_por?: string | null
          created_at?: string
          created_by?: string | null
          data_aula_experimental?: string | null
          data_perda?: string | null
          email?: string | null
          follow_up_enviado_em?: string | null
          follow_up_responsavel?: string | null
          follow_up_whatsapp_enviado?: boolean | null
          hora_aula_experimental?: string | null
          id?: string
          is_matriculado?: boolean
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          plano_escolhido?: string | null
          status_funil?: string
          telefone?: string | null
          unidade_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          atendido_por?: string | null
          ativo?: boolean
          cadastrado_por?: string | null
          created_at?: string
          created_by?: string | null
          data_aula_experimental?: string | null
          data_perda?: string | null
          email?: string | null
          follow_up_enviado_em?: string | null
          follow_up_responsavel?: string | null
          follow_up_whatsapp_enviado?: boolean | null
          hora_aula_experimental?: string | null
          id?: string
          is_matriculado?: boolean
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          plano_escolhido?: string | null
          status_funil?: string
          telefone?: string | null
          unidade_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_estoque: {
        Row: {
          created_at: string
          created_by: string | null
          fornecedor: string | null
          id: string
          insumo_id: string
          nota_fiscal: string | null
          observacao: string | null
          quantidade: number
          responsavel: string
          setor: string | null
          tipo: string
          unidade_id: string
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fornecedor?: string | null
          id?: string
          insumo_id: string
          nota_fiscal?: string | null
          observacao?: string | null
          quantidade: number
          responsavel: string
          setor?: string | null
          tipo: string
          unidade_id?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fornecedor?: string | null
          id?: string
          insumo_id?: string
          nota_fiscal?: string | null
          observacao?: string | null
          quantidade?: number
          responsavel?: string
          setor?: string | null
          tipo?: string
          unidade_id?: string
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_estoque_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_estoque_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_mensais: {
        Row: {
          confirmado_por: string | null
          created_at: string
          data_confirmacao: string
          data_vencimento: string
          id: string
          interacao_id: string
          lead_id: string
          observacao: string | null
          unidade_id: string
          valor: number | null
        }
        Insert: {
          confirmado_por?: string | null
          created_at?: string
          data_confirmacao?: string
          data_vencimento: string
          id?: string
          interacao_id: string
          lead_id: string
          observacao?: string | null
          unidade_id: string
          valor?: number | null
        }
        Update: {
          confirmado_por?: string | null
          created_at?: string
          data_confirmacao?: string
          data_vencimento?: string
          id?: string
          interacao_id?: string
          lead_id?: string
          observacao?: string | null
          unidade_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_mensais_interacao_id_fkey"
            columns: ["interacao_id"]
            isOneToOne: false
            referencedRelation: "interacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorio_gerencial_zn: {
        Row: {
          adimplentes: number
          ativos: number
          cancelamentos: number
          capacidade_zn: number
          churn_percentual: number
          created_at: string
          created_by: string | null
          id: string
          inadimplentes: number
          mes_ano: string
          observacoes: string | null
          renovacoes: number
          suspensos: number
          tempo_medio_vida: number
          ticket_medio: number
          total_a_vencer: number | null
          unidade_id: string
          updated_at: string
          vip: number
        }
        Insert: {
          adimplentes?: number
          ativos?: number
          cancelamentos?: number
          capacidade_zn?: number
          churn_percentual?: number
          created_at?: string
          created_by?: string | null
          id?: string
          inadimplentes?: number
          mes_ano: string
          observacoes?: string | null
          renovacoes?: number
          suspensos?: number
          tempo_medio_vida?: number
          ticket_medio?: number
          total_a_vencer?: number | null
          unidade_id?: string
          updated_at?: string
          vip?: number
        }
        Update: {
          adimplentes?: number
          ativos?: number
          cancelamentos?: number
          capacidade_zn?: number
          churn_percentual?: number
          created_at?: string
          created_by?: string | null
          id?: string
          inadimplentes?: number
          mes_ano?: string
          observacoes?: string | null
          renovacoes?: number
          suspensos?: number
          tempo_medio_vida?: number
          ticket_medio?: number
          total_a_vencer?: number | null
          unidade_id?: string
          updated_at?: string
          vip?: number
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_gerencial_zn_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      resumo_semanal_pendentes: {
        Row: {
          created_at: string
          enviado_em: string
          id: string
          respondido_em: string | null
          resposta_raw: string | null
          semana_fim: string
          semana_inicio: string
          status: string
          telefone: string
          updated_at: string
          valor_zn: number | null
          valor_zs: number | null
        }
        Insert: {
          created_at?: string
          enviado_em?: string
          id?: string
          respondido_em?: string | null
          resposta_raw?: string | null
          semana_fim: string
          semana_inicio: string
          status?: string
          telefone: string
          updated_at?: string
          valor_zn?: number | null
          valor_zs?: number | null
        }
        Update: {
          created_at?: string
          enviado_em?: string
          id?: string
          respondido_em?: string | null
          resposta_raw?: string | null
          semana_fim?: string
          semana_inicio?: string
          status?: string
          telefone?: string
          updated_at?: string
          valor_zn?: number | null
          valor_zs?: number | null
        }
        Relationships: []
      }
      rotina_atividades: {
        Row: {
          created_at: string
          horario: string | null
          id: string
          observacao: string | null
          ordem: number
          responsavel: string | null
          rotina_id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          horario?: string | null
          id?: string
          observacao?: string | null
          ordem?: number
          responsavel?: string | null
          rotina_id: string
          titulo: string
        }
        Update: {
          created_at?: string
          horario?: string | null
          id?: string
          observacao?: string | null
          ordem?: number
          responsavel?: string | null
          rotina_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotina_atividades_rotina_id_fkey"
            columns: ["rotina_id"]
            isOneToOne: false
            referencedRelation: "rotinas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotina_execucoes: {
        Row: {
          atividade_id: string | null
          concluida: boolean
          concluida_em: string | null
          concluida_por: string | null
          created_at: string
          data_execucao: string
          foto_url: string | null
          id: string
          observacao: string | null
          rotina_id: string
          unidade_id: string
        }
        Insert: {
          atividade_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data_execucao?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          rotina_id: string
          unidade_id: string
        }
        Update: {
          atividade_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          concluida_por?: string | null
          created_at?: string
          data_execucao?: string
          foto_url?: string | null
          id?: string
          observacao?: string | null
          rotina_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotina_execucoes_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "rotina_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotina_execucoes_rotina_id_fkey"
            columns: ["rotina_id"]
            isOneToOne: false
            referencedRelation: "rotinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotina_execucoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rotina_notificacoes: {
        Row: {
          data_envio: string
          enviado_em: string | null
          id: string
          rotina_id: string
          status: string | null
        }
        Insert: {
          data_envio: string
          enviado_em?: string | null
          id?: string
          rotina_id: string
          status?: string | null
        }
        Update: {
          data_envio?: string
          enviado_em?: string | null
          id?: string
          rotina_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rotina_notificacoes_rotina_id_fkey"
            columns: ["rotina_id"]
            isOneToOne: false
            referencedRelation: "rotinas"
            referencedColumns: ["id"]
          },
        ]
      }
      rotinas: {
        Row: {
          arquivada: boolean
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          frequencia: string
          horario_esperado: string | null
          id: string
          nome: string
          prioridade: string
          responsavel_conferencia: string | null
          responsavel_principal: string | null
          setor: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          frequencia?: string
          horario_esperado?: string | null
          id?: string
          nome: string
          prioridade?: string
          responsavel_conferencia?: string | null
          responsavel_principal?: string | null
          setor?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          frequencia?: string
          horario_esperado?: string | null
          id?: string
          nome?: string
          prioridade?: string
          responsavel_conferencia?: string | null
          responsavel_principal?: string | null
          setor?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotinas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          task_id: string
          user_id: string | null
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string | null
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_history: {
        Row: {
          campo: string
          created_at: string
          id: string
          task_id: string
          user_id: string | null
          user_name: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string
          id?: string
          task_id: string
          user_id?: string | null
          user_name: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string | null
          user_name?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string | null
          task_id: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          task_id?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string | null
          task_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          concluido: boolean
          created_at: string
          id: string
          ordem: number
          task_id: string
          titulo: string
        }
        Insert: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          task_id: string
          titulo: string
        }
        Update: {
          concluido?: boolean
          created_at?: string
          id?: string
          ordem?: number
          task_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          arquivada: boolean
          concluida_em: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          hora_prazo: string | null
          id: string
          notificado_24h: boolean | null
          notificado_prazo: boolean | null
          prazo: string | null
          prioridade: string
          recorrencia: string | null
          recorrencia_fim: string | null
          responsavel: string
          setor: string | null
          status: string
          titulo: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          hora_prazo?: string | null
          id?: string
          notificado_24h?: boolean | null
          notificado_prazo?: boolean | null
          prazo?: string | null
          prioridade?: string
          recorrencia?: string | null
          recorrencia_fim?: string | null
          responsavel: string
          setor?: string | null
          status?: string
          titulo: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          hora_prazo?: string | null
          id?: string
          notificado_24h?: boolean | null
          notificado_prazo?: boolean | null
          prazo?: string | null
          prioridade?: string
          recorrencia?: string | null
          recorrencia_fim?: string | null
          responsavel?: string
          setor?: string | null
          status?: string
          titulo?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          slug: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          slug: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_unidades: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          unidade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          unidade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          unidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_cleanup_duplicate_leads: {
        Args: { lead_ids: string[] }
        Returns: number
      }
      admin_standardize_origem: {
        Args: { new_value: string; old_value: string }
        Returns: number
      }
      admin_standardize_treinador: {
        Args: { new_value: string; old_value: string }
        Returns: number
      }
      admin_update_cadastrador: {
        Args: { new_name: string; old_name: string }
        Returns: number
      }
      find_user_by_name: { Args: { p_name: string }; Returns: string }
      generate_follow_ups_for_lead: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      get_user_phone_by_name: { Args: { p_name: string }; Returns: string }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      get_user_unidades: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      inativar_aluno: { Args: { p_lead_id: string }; Returns: undefined }
      normalize_phone: { Args: { phone: string }; Returns: string }
      user_has_unidade_access: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "coordenador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "coordenador"],
    },
  },
} as const

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
      insumos: {
        Row: {
          ativo: boolean
          categoria: string
          codigo_insumo: string
          created_at: string
          id: string
          nome_insumo: string
          quantidade_minima: number
          unidade_id: string | null
          unidade_medida: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          codigo_insumo: string
          created_at?: string
          id?: string
          nome_insumo: string
          quantidade_minima?: number
          unidade_id?: string | null
          unidade_medida: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          codigo_insumo?: string
          created_at?: string
          id?: string
          nome_insumo?: string
          quantidade_minima?: number
          unidade_id?: string | null
          unidade_medida?: string
          updated_at?: string
        }
        Relationships: [
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
          descricao: string | null
          fechou_matricula: boolean | null
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
          descricao?: string | null
          fechou_matricula?: boolean | null
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
          descricao?: string | null
          fechou_matricula?: boolean | null
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
      leads: {
        Row: {
          atendido_por: string | null
          ativo: boolean
          cadastrado_por: string | null
          created_at: string
          created_by: string | null
          data_aula_experimental: string | null
          email: string | null
          follow_up_enviado_em: string | null
          follow_up_responsavel: string | null
          follow_up_whatsapp_enviado: boolean | null
          hora_aula_experimental: string | null
          id: string
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
          email?: string | null
          follow_up_enviado_em?: string | null
          follow_up_responsavel?: string | null
          follow_up_whatsapp_enviado?: boolean | null
          hora_aula_experimental?: string | null
          id?: string
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
          email?: string | null
          follow_up_enviado_em?: string | null
          follow_up_responsavel?: string | null
          follow_up_whatsapp_enviado?: boolean | null
          hora_aula_experimental?: string | null
          id?: string
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
          id: string
          insumo_id: string
          observacao: string | null
          quantidade: number
          responsavel: string
          setor: string | null
          tipo: string
          unidade_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          insumo_id: string
          observacao?: string | null
          quantidade: number
          responsavel: string
          setor?: string | null
          tipo: string
          unidade_id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          insumo_id?: string
          observacao?: string | null
          quantidade?: number
          responsavel?: string
          setor?: string | null
          tipo?: string
          unidade_id?: string
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
      generate_follow_ups_for_lead: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      get_user_role: { Args: { p_user_id: string }; Returns: string }
      get_user_unidades: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_has_unidade_access: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

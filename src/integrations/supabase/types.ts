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
      interacoes: {
        Row: {
          agendou_experimental: boolean | null
          atendido_por: string | null
          atendido_por_tipo: string | null
          comissao_comercial: number | null
          comissao_recepcao: number | null
          compareceu: boolean | null
          created_at: string
          data_experimental: string | null
          data_fechamento: string | null
          data_interacao: string
          descricao: string | null
          fechou_matricula: boolean | null
          hora_experimental: string | null
          id: string
          lead_id: string
          origem_fechamento: string | null
          plano_escolhido: string | null
          quem_agendou: string | null
          reagendou: boolean | null
          responsavel_fechamento: string | null
          tipo: string
          tipo_atendimento: string | null
          treinador_experimental: string | null
          treinador_responsavel: string | null
          valor_plano: number | null
        }
        Insert: {
          agendou_experimental?: boolean | null
          atendido_por?: string | null
          atendido_por_tipo?: string | null
          comissao_comercial?: number | null
          comissao_recepcao?: number | null
          compareceu?: boolean | null
          created_at?: string
          data_experimental?: string | null
          data_fechamento?: string | null
          data_interacao?: string
          descricao?: string | null
          fechou_matricula?: boolean | null
          hora_experimental?: string | null
          id?: string
          lead_id: string
          origem_fechamento?: string | null
          plano_escolhido?: string | null
          quem_agendou?: string | null
          reagendou?: boolean | null
          responsavel_fechamento?: string | null
          tipo: string
          tipo_atendimento?: string | null
          treinador_experimental?: string | null
          treinador_responsavel?: string | null
          valor_plano?: number | null
        }
        Update: {
          agendou_experimental?: boolean | null
          atendido_por?: string | null
          atendido_por_tipo?: string | null
          comissao_comercial?: number | null
          comissao_recepcao?: number | null
          compareceu?: boolean | null
          created_at?: string
          data_experimental?: string | null
          data_fechamento?: string | null
          data_interacao?: string
          descricao?: string | null
          fechou_matricula?: boolean | null
          hora_experimental?: string | null
          id?: string
          lead_id?: string
          origem_fechamento?: string | null
          plano_escolhido?: string | null
          quem_agendou?: string | null
          reagendou?: boolean | null
          responsavel_fechamento?: string | null
          tipo?: string
          tipo_atendimento?: string | null
          treinador_experimental?: string | null
          treinador_responsavel?: string | null
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
        ]
      }
      leads: {
        Row: {
          atendido_por: string | null
          ativo: boolean
          created_at: string
          data_aula_experimental: string | null
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          plano_escolhido: string | null
          status_funil: string
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          atendido_por?: string | null
          ativo?: boolean
          created_at?: string
          data_aula_experimental?: string | null
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          plano_escolhido?: string | null
          status_funil?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          atendido_por?: string | null
          ativo?: boolean
          created_at?: string
          data_aula_experimental?: string | null
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          plano_escolhido?: string | null
          status_funil?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

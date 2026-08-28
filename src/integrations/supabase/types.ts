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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agente_atendimentos: {
        Row: {
          agente_id: string
          aluno_id: string | null
          canal: string
          created_at: string
          dia_experimental: string | null
          experimental_solicitada: boolean
          horario_experimental: string | null
          horario_treino: string | null
          id: string
          lead_id: string | null
          nome: string | null
          objetivo: string | null
          plano_indicado: string | null
          primeira_interacao_at: string | null
          resumo_conversa: string | null
          status: string
          telefone: string | null
          ultima_interacao_at: string | null
          unidade_id: string
          unidade_interesse: string | null
          updated_at: string
        }
        Insert: {
          agente_id: string
          aluno_id?: string | null
          canal?: string
          created_at?: string
          dia_experimental?: string | null
          experimental_solicitada?: boolean
          horario_experimental?: string | null
          horario_treino?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          objetivo?: string | null
          plano_indicado?: string | null
          primeira_interacao_at?: string | null
          resumo_conversa?: string | null
          status?: string
          telefone?: string | null
          ultima_interacao_at?: string | null
          unidade_id: string
          unidade_interesse?: string | null
          updated_at?: string
        }
        Update: {
          agente_id?: string
          aluno_id?: string | null
          canal?: string
          created_at?: string
          dia_experimental?: string | null
          experimental_solicitada?: boolean
          horario_experimental?: string | null
          horario_treino?: string | null
          id?: string
          lead_id?: string | null
          nome?: string | null
          objetivo?: string | null
          plano_indicado?: string | null
          primeira_interacao_at?: string | null
          resumo_conversa?: string | null
          status?: string
          telefone?: string | null
          ultima_interacao_at?: string | null
          unidade_id?: string
          unidade_interesse?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_atendimentos_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      agente_mensagens: {
        Row: {
          atendimento_id: string
          conteudo: string
          created_at: string
          external_message_id: string | null
          id: string
          role: string
          unidade_id: string
        }
        Insert: {
          atendimento_id: string
          conteudo: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          role: string
          unidade_id: string
        }
        Update: {
          atendimento_id?: string
          conteudo?: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          role?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_mensagens_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "agente_atendimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes_atendimento: {
        Row: {
          atualizado_por: string | null
          canal: string
          configuracao_experimental: Json
          created_at: string
          criado_por: string | null
          descricao: string | null
          gatilho_ativacao: string | null
          id: string
          mensagem_inicial: string | null
          mensagem_pos_solicitacao: string | null
          nome: string
          prompt: string | null
          regras: Json
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          atualizado_por?: string | null
          canal?: string
          configuracao_experimental?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          gatilho_ativacao?: string | null
          id?: string
          mensagem_inicial?: string | null
          mensagem_pos_solicitacao?: string | null
          nome?: string
          prompt?: string | null
          regras?: Json
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          atualizado_por?: string | null
          canal?: string
          configuracao_experimental?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          gatilho_ativacao?: string | null
          id?: string
          mensagem_inicial?: string | null
          mensagem_pos_solicitacao?: string | null
          nome?: string
          prompt?: string | null
          regras?: Json
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      agentes_atendimento_versoes: {
        Row: {
          agente_id: string
          configuracao_experimental: Json
          created_at: string
          criado_por: string | null
          criado_por_nome: string | null
          descricao: string | null
          id: string
          mensagem_inicial: string | null
          mensagem_pos_solicitacao: string | null
          nome: string | null
          prompt: string | null
          regras: Json
          status: string | null
          unidade_id: string
        }
        Insert: {
          agente_id: string
          configuracao_experimental?: Json
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          mensagem_inicial?: string | null
          mensagem_pos_solicitacao?: string | null
          nome?: string | null
          prompt?: string | null
          regras?: Json
          status?: string | null
          unidade_id: string
        }
        Update: {
          agente_id?: string
          configuracao_experimental?: Json
          created_at?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          descricao?: string | null
          id?: string
          mensagem_inicial?: string | null
          mensagem_pos_solicitacao?: string | null
          nome?: string | null
          prompt?: string | null
          regras?: Json
          status?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agentes_atendimento_versoes_agente_id_fkey"
            columns: ["agente_id"]
            isOneToOne: false
            referencedRelation: "agentes_atendimento"
            referencedColumns: ["id"]
          },
        ]
      }
      anamneses_experimental: {
        Row: {
          condicao_saude_descricao: string | null
          created_at: string
          data_nascimento: string | null
          dias_semana: string | null
          frequencia_atual: string | null
          historico: string | null
          id: string
          lead_id: string
          lesao_descricao: string | null
          nome: string | null
          notificacao_tentativas: number
          notificacao_ultimo_erro: string | null
          notificado_em: string | null
          objetivo: string | null
          observacoes: string | null
          obstaculo: string | null
          preenchido_por: string | null
          preferencia_horario: string[] | null
          tem_condicao_saude: boolean | null
          tem_lesao: boolean | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          condicao_saude_descricao?: string | null
          created_at?: string
          data_nascimento?: string | null
          dias_semana?: string | null
          frequencia_atual?: string | null
          historico?: string | null
          id?: string
          lead_id: string
          lesao_descricao?: string | null
          nome?: string | null
          notificacao_tentativas?: number
          notificacao_ultimo_erro?: string | null
          notificado_em?: string | null
          objetivo?: string | null
          observacoes?: string | null
          obstaculo?: string | null
          preenchido_por?: string | null
          preferencia_horario?: string[] | null
          tem_condicao_saude?: boolean | null
          tem_lesao?: boolean | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          condicao_saude_descricao?: string | null
          created_at?: string
          data_nascimento?: string | null
          dias_semana?: string | null
          frequencia_atual?: string | null
          historico?: string | null
          id?: string
          lead_id?: string
          lesao_descricao?: string | null
          nome?: string | null
          notificacao_tentativas?: number
          notificacao_ultimo_erro?: string | null
          notificado_em?: string | null
          objetivo?: string | null
          observacoes?: string | null
          obstaculo?: string | null
          preenchido_por?: string | null
          preferencia_horario?: string[] | null
          tem_condicao_saude?: boolean | null
          tem_lesao?: boolean | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          chave: string
          created_at: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          created_at?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          agencia: string | null
          baixa_observacoes: string | null
          baixado_em: string | null
          baixado_por: string | null
          baixado_por_nome: string | null
          banco: string | null
          cancelado_em: string | null
          cancelado_por_nome: string | null
          categoria: string | null
          centro_custo: string | null
          chave_pix: string | null
          codigo_barras: string | null
          codigo_pix: string | null
          competencia: string | null
          comprovante_url: string | null
          conta_bancaria: string | null
          created_at: string
          created_by: string | null
          created_by_nome: string | null
          data_pagamento: string | null
          data_vencimento: string
          deleted_at: string | null
          desconto: number
          descricao: string
          documento_url: string | null
          favorecido: string | null
          forma_pagamento: string | null
          forma_pagamento_baixa: string | null
          fornecedor: string | null
          id: string
          juros: number
          linha_digitavel: string | null
          link_pagamento: string | null
          multa: number
          numero_fatura: string | null
          observacoes: string | null
          prioridade: string
          status: string
          unidade_id: string
          updated_at: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          agencia?: string | null
          baixa_observacoes?: string | null
          baixado_em?: string | null
          baixado_por?: string | null
          baixado_por_nome?: string | null
          banco?: string | null
          cancelado_em?: string | null
          cancelado_por_nome?: string | null
          categoria?: string | null
          centro_custo?: string | null
          chave_pix?: string | null
          codigo_barras?: string | null
          codigo_pix?: string | null
          competencia?: string | null
          comprovante_url?: string | null
          conta_bancaria?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          deleted_at?: string | null
          desconto?: number
          descricao: string
          documento_url?: string | null
          favorecido?: string | null
          forma_pagamento?: string | null
          forma_pagamento_baixa?: string | null
          fornecedor?: string | null
          id?: string
          juros?: number
          linha_digitavel?: string | null
          link_pagamento?: string | null
          multa?: number
          numero_fatura?: string | null
          observacoes?: string | null
          prioridade?: string
          status?: string
          unidade_id: string
          updated_at?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          agencia?: string | null
          baixa_observacoes?: string | null
          baixado_em?: string | null
          baixado_por?: string | null
          baixado_por_nome?: string | null
          banco?: string | null
          cancelado_em?: string | null
          cancelado_por_nome?: string | null
          categoria?: string | null
          centro_custo?: string | null
          chave_pix?: string | null
          codigo_barras?: string | null
          codigo_pix?: string | null
          competencia?: string | null
          comprovante_url?: string | null
          conta_bancaria?: string | null
          created_at?: string
          created_by?: string | null
          created_by_nome?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          deleted_at?: string | null
          desconto?: number
          descricao?: string
          documento_url?: string | null
          favorecido?: string | null
          forma_pagamento?: string | null
          forma_pagamento_baixa?: string | null
          fornecedor?: string | null
          id?: string
          juros?: number
          linha_digitavel?: string | null
          link_pagamento?: string | null
          multa?: number
          numero_fatura?: string | null
          observacoes?: string | null
          prioridade?: string
          status?: string
          unidade_id?: string
          updated_at?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_envios: {
        Row: {
          conta_id: string
          created_at: string
          erro_msg: string | null
          grupo_destino: string | null
          id: string
          instancia_id: string | null
          mensagem_enviada: string | null
          proxima_tentativa_em: string | null
          status: string
          tentativas: number
          tipo_envio: string
          ultima_tentativa_em: string | null
          unidade_id: string
          updated_at: string
          zapi_message_id: string | null
        }
        Insert: {
          conta_id: string
          created_at?: string
          erro_msg?: string | null
          grupo_destino?: string | null
          id?: string
          instancia_id?: string | null
          mensagem_enviada?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          tentativas?: number
          tipo_envio: string
          ultima_tentativa_em?: string | null
          unidade_id: string
          updated_at?: string
          zapi_message_id?: string | null
        }
        Update: {
          conta_id?: string
          created_at?: string
          erro_msg?: string | null
          grupo_destino?: string | null
          id?: string
          instancia_id?: string | null
          mensagem_enviada?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          tentativas?: number
          tipo_envio?: string
          ultima_tentativa_em?: string | null
          unidade_id?: string
          updated_at?: string
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_envios_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_pagar_historico: {
        Row: {
          acao: string
          campo: string | null
          conta_id: string
          created_at: string
          id: string
          user_id: string | null
          user_nome: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          acao: string
          campo?: string | null
          conta_id: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          acao?: string
          campo?: string | null
          conta_id?: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_nome?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_historico_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas_pagar"
            referencedColumns: ["id"]
          },
        ]
      }
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
          tipo_atividade: string | null
          titulo: string
          turno: string | null
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
          tipo_atividade?: string | null
          titulo: string
          turno?: string | null
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
          tipo_atividade?: string | null
          titulo?: string
          turno?: string | null
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
      cronograma_atividades_historico: {
        Row: {
          atividade_id: string | null
          bulk_operation_id: string | null
          campo: string
          created_at: string
          id: string
          user_id: string | null
          user_name: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          atividade_id?: string | null
          bulk_operation_id?: string | null
          campo: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          atividade_id?: string | null
          bulk_operation_id?: string | null
          campo?: string
          created_at?: string
          id?: string
          user_id?: string | null
          user_name?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_atividades_historico_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "cronograma_atividades"
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
          cargo: string | null
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
          cargo?: string | null
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
          cargo?: string | null
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
      encerramento_coordenador_respostas: {
        Row: {
          climatizacao: number | null
          created_at: string
          destaque_descricao: string | null
          destaque_positivo: boolean | null
          elogio_aluno: boolean | null
          elogio_descricao: string | null
          equipamentos_funcionando: number | null
          faltas_atrasos: string | null
          feedback_corretivo: boolean | null
          feedback_descricao: string | null
          fora_padrao_descricao: string | null
          funcionou_bem: string | null
          id: string
          infraestrutura: number | null
          limpeza_geral: number | null
          nome: string
          nota_geral: number | null
          ocorrencia_acao: string | null
          ocorrencia_descricao: string | null
          ocorrencia_gravidade: string | null
          ocorrencia_pendencia: string | null
          ocorrencia_resolvida: boolean | null
          ocorrencia_tipo: string | null
          organizacao_espaco: number | null
          padrao_iron: boolean | null
          pendencias_abertas: string | null
          pontos_atencao: string | null
          postura_atendimento: number | null
          proatividade: number | null
          reclamacao_acao: string | null
          reclamacao_aluno: boolean | null
          reclamacao_descricao: string | null
          reclamacao_pendencia: string | null
          reclamacao_resolvida: boolean | null
          teve_ocorrencia: boolean | null
          todos_compareceram: boolean | null
          turno: string
          ultimo_turno_dia: boolean
          unidade: string
        }
        Insert: {
          climatizacao?: number | null
          created_at?: string
          destaque_descricao?: string | null
          destaque_positivo?: boolean | null
          elogio_aluno?: boolean | null
          elogio_descricao?: string | null
          equipamentos_funcionando?: number | null
          faltas_atrasos?: string | null
          feedback_corretivo?: boolean | null
          feedback_descricao?: string | null
          fora_padrao_descricao?: string | null
          funcionou_bem?: string | null
          id?: string
          infraestrutura?: number | null
          limpeza_geral?: number | null
          nome: string
          nota_geral?: number | null
          ocorrencia_acao?: string | null
          ocorrencia_descricao?: string | null
          ocorrencia_gravidade?: string | null
          ocorrencia_pendencia?: string | null
          ocorrencia_resolvida?: boolean | null
          ocorrencia_tipo?: string | null
          organizacao_espaco?: number | null
          padrao_iron?: boolean | null
          pendencias_abertas?: string | null
          pontos_atencao?: string | null
          postura_atendimento?: number | null
          proatividade?: number | null
          reclamacao_acao?: string | null
          reclamacao_aluno?: boolean | null
          reclamacao_descricao?: string | null
          reclamacao_pendencia?: string | null
          reclamacao_resolvida?: boolean | null
          teve_ocorrencia?: boolean | null
          todos_compareceram?: boolean | null
          turno: string
          ultimo_turno_dia?: boolean
          unidade: string
        }
        Update: {
          climatizacao?: number | null
          created_at?: string
          destaque_descricao?: string | null
          destaque_positivo?: boolean | null
          elogio_aluno?: boolean | null
          elogio_descricao?: string | null
          equipamentos_funcionando?: number | null
          faltas_atrasos?: string | null
          feedback_corretivo?: boolean | null
          feedback_descricao?: string | null
          fora_padrao_descricao?: string | null
          funcionou_bem?: string | null
          id?: string
          infraestrutura?: number | null
          limpeza_geral?: number | null
          nome?: string
          nota_geral?: number | null
          ocorrencia_acao?: string | null
          ocorrencia_descricao?: string | null
          ocorrencia_gravidade?: string | null
          ocorrencia_pendencia?: string | null
          ocorrencia_resolvida?: boolean | null
          ocorrencia_tipo?: string | null
          organizacao_espaco?: number | null
          padrao_iron?: boolean | null
          pendencias_abertas?: string | null
          pontos_atencao?: string | null
          postura_atendimento?: number | null
          proatividade?: number | null
          reclamacao_acao?: string | null
          reclamacao_aluno?: boolean | null
          reclamacao_descricao?: string | null
          reclamacao_pendencia?: string | null
          reclamacao_resolvida?: boolean | null
          teve_ocorrencia?: boolean | null
          todos_compareceram?: boolean | null
          turno?: string
          ultimo_turno_dia?: boolean
          unidade?: string
        }
        Relationships: []
      }
      encerramento_horario_respostas: {
        Row: {
          atendimentos_json: Json | null
          atendimentos_por_treinador: string | null
          created_at: string
          data: string
          destaque_descricao: string | null
          destaque_positivo: boolean | null
          experimentais_realizadas: number | null
          feedback_aluno_descricao: string | null
          feedback_corretivo: boolean | null
          feedback_corretivo_descricao: string | null
          id: string
          nome: string
          nota_geral: number | null
          observacoes: string | null
          ocorrencia_descricao: string | null
          pendencia_organizacao: string | null
          sala_organizada: boolean | null
          teve_feedback_aluno: boolean | null
          teve_ocorrencia: boolean | null
          treinador_faltou: boolean | null
          treinador_faltou_quem: string | null
          turno: string
          unidade: string
        }
        Insert: {
          atendimentos_json?: Json | null
          atendimentos_por_treinador?: string | null
          created_at?: string
          data: string
          destaque_descricao?: string | null
          destaque_positivo?: boolean | null
          experimentais_realizadas?: number | null
          feedback_aluno_descricao?: string | null
          feedback_corretivo?: boolean | null
          feedback_corretivo_descricao?: string | null
          id?: string
          nome: string
          nota_geral?: number | null
          observacoes?: string | null
          ocorrencia_descricao?: string | null
          pendencia_organizacao?: string | null
          sala_organizada?: boolean | null
          teve_feedback_aluno?: boolean | null
          teve_ocorrencia?: boolean | null
          treinador_faltou?: boolean | null
          treinador_faltou_quem?: string | null
          turno: string
          unidade: string
        }
        Update: {
          atendimentos_json?: Json | null
          atendimentos_por_treinador?: string | null
          created_at?: string
          data?: string
          destaque_descricao?: string | null
          destaque_positivo?: boolean | null
          experimentais_realizadas?: number | null
          feedback_aluno_descricao?: string | null
          feedback_corretivo?: boolean | null
          feedback_corretivo_descricao?: string | null
          id?: string
          nome?: string
          nota_geral?: number | null
          observacoes?: string | null
          ocorrencia_descricao?: string | null
          pendencia_organizacao?: string | null
          sala_organizada?: boolean | null
          teve_feedback_aluno?: boolean | null
          teve_ocorrencia?: boolean | null
          treinador_faltou?: boolean | null
          treinador_faltou_quem?: string | null
          turno?: string
          unidade?: string
        }
        Relationships: []
      }
      encerramento_turno_respostas: {
        Row: {
          clima_equipe: number
          clima_influencia: string | null
          created_at: string
          equipamento_descricao: string | null
          equipamento_problema: boolean
          experimentais_realizadas: number
          faria_diferente: string | null
          feedback_descricao: string | null
          id: string
          manteve_padrao: boolean
          nome: string
          observacao_gestao: string | null
          ocorrencia_descricao: string | null
          padrao_observacao: string | null
          precisou_suporte: boolean
          recebeu_feedback: boolean
          suporte_descricao: string | null
          teve_ocorrencia: boolean
          turno: string
          unidade: string
        }
        Insert: {
          clima_equipe?: number
          clima_influencia?: string | null
          created_at?: string
          equipamento_descricao?: string | null
          equipamento_problema?: boolean
          experimentais_realizadas?: number
          faria_diferente?: string | null
          feedback_descricao?: string | null
          id?: string
          manteve_padrao?: boolean
          nome: string
          observacao_gestao?: string | null
          ocorrencia_descricao?: string | null
          padrao_observacao?: string | null
          precisou_suporte?: boolean
          recebeu_feedback?: boolean
          suporte_descricao?: string | null
          teve_ocorrencia?: boolean
          turno: string
          unidade: string
        }
        Update: {
          clima_equipe?: number
          clima_influencia?: string | null
          created_at?: string
          equipamento_descricao?: string | null
          equipamento_problema?: boolean
          experimentais_realizadas?: number
          faria_diferente?: string | null
          feedback_descricao?: string | null
          id?: string
          manteve_padrao?: boolean
          nome?: string
          observacao_gestao?: string | null
          ocorrencia_descricao?: string | null
          padrao_observacao?: string | null
          precisou_suporte?: boolean
          recebeu_feedback?: boolean
          suporte_descricao?: string | null
          teve_ocorrencia?: boolean
          turno?: string
          unidade?: string
        }
        Relationships: []
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
      forecast_cenarios: {
        Row: {
          created_at: string
          created_by: string
          id: string
          nome: string
          parametros: Json
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          nome: string
          parametros?: Json
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          nome?: string
          parametros?: Json
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_cenarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_metas: {
        Row: {
          ano: number
          cac_maximo: number | null
          created_at: string
          created_by: string | null
          id: string
          mes: number
          meta_alunos_ativos: number | null
          meta_matriculas: number | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ano: number
          cac_maximo?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          mes: number
          meta_alunos_ativos?: number | null
          meta_matriculas?: number | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ano?: number
          cac_maximo?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          mes?: number
          meta_alunos_ativos?: number | null
          meta_matriculas?: number | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_metas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_premissas: {
        Row: {
          ano: number
          aproveitamento_atendimento: number | null
          base_inicial: number | null
          capacidade_maxima: number | null
          churn_mensal: number
          cpl_projetado: number | null
          created_at: string
          created_by: string | null
          custo_por_conversa: number | null
          id: string
          investimento_previsto: number
          mensalidade_media: number | null
          mes: number
          meta_alunos: number | null
          observacoes: string | null
          taxa_agendamento_comparecimento: number
          taxa_comparecimento_matricula: number
          taxa_conversa_lead: number
          taxa_lead_agendamento: number
          ticket_medio: number | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ano: number
          aproveitamento_atendimento?: number | null
          base_inicial?: number | null
          capacidade_maxima?: number | null
          churn_mensal?: number
          cpl_projetado?: number | null
          created_at?: string
          created_by?: string | null
          custo_por_conversa?: number | null
          id?: string
          investimento_previsto?: number
          mensalidade_media?: number | null
          mes: number
          meta_alunos?: number | null
          observacoes?: string | null
          taxa_agendamento_comparecimento?: number
          taxa_comparecimento_matricula?: number
          taxa_conversa_lead?: number
          taxa_lead_agendamento?: number
          ticket_medio?: number | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ano?: number
          aproveitamento_atendimento?: number | null
          base_inicial?: number | null
          capacidade_maxima?: number | null
          churn_mensal?: number
          cpl_projetado?: number | null
          created_at?: string
          created_by?: string | null
          custo_por_conversa?: number | null
          id?: string
          investimento_previsto?: number
          mensalidade_media?: number | null
          mes?: number
          meta_alunos?: number | null
          observacoes?: string | null
          taxa_agendamento_comparecimento?: number
          taxa_comparecimento_matricula?: number
          taxa_conversa_lead?: number
          taxa_lead_agendamento?: number
          ticket_medio?: number | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_premissas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_realizado: {
        Row: {
          alunos_ativos: number | null
          ano: number
          base_final: number | null
          base_inicial: number | null
          cancelamentos: number | null
          comparecimentos: number | null
          conversas_iniciadas: number | null
          created_at: string
          created_by: string | null
          experimentais_marcadas: number | null
          fechado: boolean
          fechado_em: string | null
          fechado_por: string | null
          id: string
          investimento_real: number | null
          leads_crm: number | null
          matriculas_total: number | null
          matriculas_trafego: number | null
          mes: number
          observacoes: string | null
          ticket_medio: number | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          alunos_ativos?: number | null
          ano: number
          base_final?: number | null
          base_inicial?: number | null
          cancelamentos?: number | null
          comparecimentos?: number | null
          conversas_iniciadas?: number | null
          created_at?: string
          created_by?: string | null
          experimentais_marcadas?: number | null
          fechado?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          investimento_real?: number | null
          leads_crm?: number | null
          matriculas_total?: number | null
          matriculas_trafego?: number | null
          mes: number
          observacoes?: string | null
          ticket_medio?: number | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          alunos_ativos?: number | null
          ano?: number
          base_final?: number | null
          base_inicial?: number | null
          cancelamentos?: number | null
          comparecimentos?: number | null
          conversas_iniciadas?: number | null
          created_at?: string
          created_by?: string | null
          experimentais_marcadas?: number | null
          fechado?: boolean
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          investimento_real?: number | null
          leads_crm?: number | null
          matriculas_total?: number | null
          matriculas_trafego?: number | null
          mes?: number
          observacoes?: string | null
          ticket_medio?: number | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_realizado_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_semanal: {
        Row: {
          alunos_segunda: number
          alunos_sexta: number | null
          cancelamentos: number
          created_at: string
          created_by: string | null
          id: string
          matriculas: number
          observacoes: string | null
          semana_inicio: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          alunos_segunda?: number
          alunos_sexta?: number | null
          cancelamentos?: number
          created_at?: string
          created_by?: string | null
          id?: string
          matriculas?: number
          observacoes?: string | null
          semana_inicio: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          alunos_segunda?: number
          alunos_sexta?: number | null
          cancelamentos?: number
          created_at?: string
          created_by?: string | null
          id?: string
          matriculas?: number
          observacoes?: string | null
          semana_inicio?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_semanal_unidade_id_fkey"
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
      formulario_envios_log: {
        Row: {
          created_at: string
          destino_grupo_hash: string | null
          error_message: string | null
          id: string
          idempotency_key: string
          origem: string
          payload_hash: string | null
          requested_by: string | null
          resposta_id: string | null
          sent_at: string | null
          status: string
          tipo_formulario: string
          unidade: string
          unidade_id: string | null
        }
        Insert: {
          created_at?: string
          destino_grupo_hash?: string | null
          error_message?: string | null
          id?: string
          idempotency_key: string
          origem: string
          payload_hash?: string | null
          requested_by?: string | null
          resposta_id?: string | null
          sent_at?: string | null
          status: string
          tipo_formulario: string
          unidade: string
          unidade_id?: string | null
        }
        Update: {
          created_at?: string
          destino_grupo_hash?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string
          origem?: string
          payload_hash?: string | null
          requested_by?: string | null
          resposta_id?: string | null
          sent_at?: string | null
          status?: string
          tipo_formulario?: string
          unidade?: string
          unidade_id?: string | null
        }
        Relationships: []
      }
      formulario_grupos_whatsapp: {
        Row: {
          ativo: boolean
          canal: string
          created_at: string
          formulario_key: string
          grupo_id: string | null
          grupo_nome: string | null
          id: string
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          created_at?: string
          formulario_key: string
          grupo_id?: string | null
          grupo_nome?: string | null
          id?: string
          unidade: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          created_at?: string
          formulario_key?: string
          grupo_id?: string | null
          grupo_nome?: string | null
          id?: string
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      formulario_lembretes: {
        Row: {
          atividade_id: string | null
          chave: string
          created_at: string
          data: string
          erro_zapi: string | null
          formulario_tipo: string
          formulario_titulo: string | null
          horario_lembrete: string
          horario_previsto: string | null
          id: string
          responsavel_id: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          status_lembrete: string
          status_preenchimento: string | null
          tentativas: number
          turno: string | null
          unidade_id: string
          unidade_nome: string | null
          updated_at: string
          zapi_response: Json | null
        }
        Insert: {
          atividade_id?: string | null
          chave: string
          created_at?: string
          data: string
          erro_zapi?: string | null
          formulario_tipo: string
          formulario_titulo?: string | null
          horario_lembrete?: string
          horario_previsto?: string | null
          id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          status_lembrete: string
          status_preenchimento?: string | null
          tentativas?: number
          turno?: string | null
          unidade_id: string
          unidade_nome?: string | null
          updated_at?: string
          zapi_response?: Json | null
        }
        Update: {
          atividade_id?: string | null
          chave?: string
          created_at?: string
          data?: string
          erro_zapi?: string | null
          formulario_tipo?: string
          formulario_titulo?: string | null
          horario_lembrete?: string
          horario_previsto?: string | null
          id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          status_lembrete?: string
          status_preenchimento?: string | null
          tentativas?: number
          turno?: string | null
          unidade_id?: string
          unidade_nome?: string | null
          updated_at?: string
          zapi_response?: Json | null
        }
        Relationships: []
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
      gestao_lancamentos_semanais: {
        Row: {
          cancelamentos: number
          comparecimentos: number
          created_at: string
          created_by: string | null
          experimentais_agendados: number
          follow_ups_pendentes: number
          id: string
          matriculas_fechadas: number
          observacoes: string | null
          receita_semana: number
          semana_referencia: string
          total_alunos_ativos: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          cancelamentos?: number
          comparecimentos?: number
          created_at?: string
          created_by?: string | null
          experimentais_agendados?: number
          follow_ups_pendentes?: number
          id?: string
          matriculas_fechadas?: number
          observacoes?: string | null
          receita_semana?: number
          semana_referencia: string
          total_alunos_ativos?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          cancelamentos?: number
          comparecimentos?: number
          created_at?: string
          created_by?: string | null
          experimentais_agendados?: number
          follow_ups_pendentes?: number
          id?: string
          matriculas_fechadas?: number
          observacoes?: string | null
          receita_semana?: number
          semana_referencia?: string
          total_alunos_ativos?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestao_lancamentos_semanais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      gestao_metas: {
        Row: {
          alunos_ativos_manual: number
          alunos_ativos_semana_anterior: number
          cac_manual: number
          capacidade_alunos: number
          created_at: string
          evasao_pct_manual: number
          id: string
          meta_alunos_mes: number
          meta_matriculas_semana: number
          meta_ocupacao_pct: number
          meta_receita_mes: number
          meta_taxa_comparecimento_pct: number
          meta_taxa_conversao_pct: number
          ticket_medio_real: number
          unidade_id: string
          updated_at: string
        }
        Insert: {
          alunos_ativos_manual?: number
          alunos_ativos_semana_anterior?: number
          cac_manual?: number
          capacidade_alunos?: number
          created_at?: string
          evasao_pct_manual?: number
          id?: string
          meta_alunos_mes?: number
          meta_matriculas_semana?: number
          meta_ocupacao_pct?: number
          meta_receita_mes?: number
          meta_taxa_comparecimento_pct?: number
          meta_taxa_conversao_pct?: number
          ticket_medio_real?: number
          unidade_id: string
          updated_at?: string
        }
        Update: {
          alunos_ativos_manual?: number
          alunos_ativos_semana_anterior?: number
          cac_manual?: number
          capacidade_alunos?: number
          created_at?: string
          evasao_pct_manual?: number
          id?: string
          meta_alunos_mes?: number
          meta_matriculas_semana?: number
          meta_ocupacao_pct?: number
          meta_receita_mes?: number
          meta_taxa_comparecimento_pct?: number
          meta_taxa_conversao_pct?: number
          ticket_medio_real?: number
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gestao_metas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: true
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
          agendado_evo: boolean
          agendou_experimental: boolean | null
          atendido_por: string | null
          atendido_por_tipo: string | null
          boas_vindas_enviada_em: string | null
          cadastrado_por: string | null
          cancelado: boolean
          cancelado_em: string | null
          comissao_cadastrador: number | null
          comissao_comercial: number | null
          comissao_recepcao: number | null
          compareceu: boolean | null
          compareceu_em: string | null
          confirmado: boolean | null
          created_at: string
          created_by: string | null
          data_avaliacao: string | null
          data_experimental: string | null
          data_fechamento: string | null
          data_interacao: string
          data_reagendamento: string | null
          data_vencimento: string | null
          descricao: string | null
          fechou_matricula: boolean | null
          feedback_pos_aula_enviado_em: string | null
          hora_avaliacao: string | null
          hora_experimental: string | null
          id: string
          lead_id: string
          motivo_cancelamento: string | null
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
          agendado_evo?: boolean
          agendou_experimental?: boolean | null
          atendido_por?: string | null
          atendido_por_tipo?: string | null
          boas_vindas_enviada_em?: string | null
          cadastrado_por?: string | null
          cancelado?: boolean
          cancelado_em?: string | null
          comissao_cadastrador?: number | null
          comissao_comercial?: number | null
          comissao_recepcao?: number | null
          compareceu?: boolean | null
          compareceu_em?: string | null
          confirmado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_experimental?: string | null
          data_fechamento?: string | null
          data_interacao?: string
          data_reagendamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          fechou_matricula?: boolean | null
          feedback_pos_aula_enviado_em?: string | null
          hora_avaliacao?: string | null
          hora_experimental?: string | null
          id?: string
          lead_id: string
          motivo_cancelamento?: string | null
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
          agendado_evo?: boolean
          agendou_experimental?: boolean | null
          atendido_por?: string | null
          atendido_por_tipo?: string | null
          boas_vindas_enviada_em?: string | null
          cadastrado_por?: string | null
          cancelado?: boolean
          cancelado_em?: string | null
          comissao_cadastrador?: number | null
          comissao_comercial?: number | null
          comissao_recepcao?: number | null
          compareceu?: boolean | null
          compareceu_em?: string | null
          confirmado?: boolean | null
          created_at?: string
          created_by?: string | null
          data_avaliacao?: string | null
          data_experimental?: string | null
          data_fechamento?: string | null
          data_interacao?: string
          data_reagendamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          fechou_matricula?: boolean | null
          feedback_pos_aula_enviado_em?: string | null
          hora_avaliacao?: string | null
          hora_experimental?: string | null
          id?: string
          lead_id?: string
          motivo_cancelamento?: string | null
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
          atendimento_id: string | null
          ativo: boolean
          cadastrado_por: string | null
          confirmacao_24h_enviada_em: string | null
          confirmacao_2h_enviada_em: string | null
          confirmacao_imediata_enviada_em: string | null
          convertido_em_aluno_at: string | null
          created_at: string
          created_by: string | null
          data_aula_experimental: string | null
          data_perda: string | null
          email: string | null
          follow_up_enviado_em: string | null
          follow_up_responsavel: string | null
          follow_up_whatsapp_enviado: boolean | null
          fonte: string | null
          hora_aula_experimental: string | null
          id: string
          is_matriculado: boolean
          motivo_perda: string | null
          nivel_interesse: string | null
          nivel_interesse_atualizado_em: string | null
          nivel_interesse_atualizado_por: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          pausado_fu: boolean
          pausado_fu_em: string | null
          pausado_fu_por: string | null
          plano_escolhido: string | null
          status_conversa: string | null
          status_funil: string
          status_taxa_experimental: string | null
          telefone: string | null
          telefone_normalizado: string | null
          treinador_experimental: string | null
          ultima_interacao_at: string | null
          unidade_id: string
          updated_at: string
          user_id: string | null
          valor_pipeline: number | null
        }
        Insert: {
          atendido_por?: string | null
          atendimento_id?: string | null
          ativo?: boolean
          cadastrado_por?: string | null
          confirmacao_24h_enviada_em?: string | null
          confirmacao_2h_enviada_em?: string | null
          confirmacao_imediata_enviada_em?: string | null
          convertido_em_aluno_at?: string | null
          created_at?: string
          created_by?: string | null
          data_aula_experimental?: string | null
          data_perda?: string | null
          email?: string | null
          follow_up_enviado_em?: string | null
          follow_up_responsavel?: string | null
          follow_up_whatsapp_enviado?: boolean | null
          fonte?: string | null
          hora_aula_experimental?: string | null
          id?: string
          is_matriculado?: boolean
          motivo_perda?: string | null
          nivel_interesse?: string | null
          nivel_interesse_atualizado_em?: string | null
          nivel_interesse_atualizado_por?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          pausado_fu?: boolean
          pausado_fu_em?: string | null
          pausado_fu_por?: string | null
          plano_escolhido?: string | null
          status_conversa?: string | null
          status_funil?: string
          status_taxa_experimental?: string | null
          telefone?: string | null
          telefone_normalizado?: string | null
          treinador_experimental?: string | null
          ultima_interacao_at?: string | null
          unidade_id?: string
          updated_at?: string
          user_id?: string | null
          valor_pipeline?: number | null
        }
        Update: {
          atendido_por?: string | null
          atendimento_id?: string | null
          ativo?: boolean
          cadastrado_por?: string | null
          confirmacao_24h_enviada_em?: string | null
          confirmacao_2h_enviada_em?: string | null
          confirmacao_imediata_enviada_em?: string | null
          convertido_em_aluno_at?: string | null
          created_at?: string
          created_by?: string | null
          data_aula_experimental?: string | null
          data_perda?: string | null
          email?: string | null
          follow_up_enviado_em?: string | null
          follow_up_responsavel?: string | null
          follow_up_whatsapp_enviado?: boolean | null
          fonte?: string | null
          hora_aula_experimental?: string | null
          id?: string
          is_matriculado?: boolean
          motivo_perda?: string | null
          nivel_interesse?: string | null
          nivel_interesse_atualizado_em?: string | null
          nivel_interesse_atualizado_por?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          pausado_fu?: boolean
          pausado_fu_em?: string | null
          pausado_fu_por?: string | null
          plano_escolhido?: string | null
          status_conversa?: string | null
          status_funil?: string
          status_taxa_experimental?: string | null
          telefone?: string | null
          telefone_normalizado?: string | null
          treinador_experimental?: string | null
          ultima_interacao_at?: string | null
          unidade_id?: string
          updated_at?: string
          user_id?: string | null
          valor_pipeline?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_atendimento_id_fkey"
            columns: ["atendimento_id"]
            isOneToOne: false
            referencedRelation: "agente_atendimentos"
            referencedColumns: ["id"]
          },
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
      nps_notificacoes_log: {
        Row: {
          aluno_erro: string | null
          aluno_message_id: string | null
          aluno_status: string | null
          aluno_telefone: string | null
          classificacao: string
          created_at: string
          id: string
          interna_erro: string | null
          interna_message_id: string | null
          interna_status: string | null
          nota_nps: number
          payload: Json | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          resposta_id: string
          unidade_id: string | null
          unidade_nome: string
        }
        Insert: {
          aluno_erro?: string | null
          aluno_message_id?: string | null
          aluno_status?: string | null
          aluno_telefone?: string | null
          classificacao: string
          created_at?: string
          id?: string
          interna_erro?: string | null
          interna_message_id?: string | null
          interna_status?: string | null
          nota_nps: number
          payload?: Json | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          resposta_id: string
          unidade_id?: string | null
          unidade_nome: string
        }
        Update: {
          aluno_erro?: string | null
          aluno_message_id?: string | null
          aluno_status?: string | null
          aluno_telefone?: string | null
          classificacao?: string
          created_at?: string
          id?: string
          interna_erro?: string | null
          interna_message_id?: string | null
          interna_status?: string | null
          nota_nps?: number
          payload?: Json | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          resposta_id?: string
          unidade_id?: string | null
          unidade_nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_notificacoes_log_resposta_id_fkey"
            columns: ["resposta_id"]
            isOneToOne: false
            referencedRelation: "nps_respostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_notificacoes_log_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      nps_respostas: {
        Row: {
          acao_corretiva: string | null
          categoria: string | null
          comentario: string | null
          created_at: string
          estrelas_equipe: number
          estrelas_estrutura: number
          estrelas_treino: number
          id: string
          lead_id: string | null
          lead_nome: string | null
          nome: string
          nota_nps: number
          pontos_melhoria: string[]
          pontos_positivos: string[]
          prazo: string | null
          status: string
          tempo_aluno: string
          unidade_id: string | null
          unidade_nome: string
          whatsapp: string
        }
        Insert: {
          acao_corretiva?: string | null
          categoria?: string | null
          comentario?: string | null
          created_at?: string
          estrelas_equipe: number
          estrelas_estrutura: number
          estrelas_treino: number
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          nome: string
          nota_nps: number
          pontos_melhoria?: string[]
          pontos_positivos?: string[]
          prazo?: string | null
          status?: string
          tempo_aluno: string
          unidade_id?: string | null
          unidade_nome: string
          whatsapp: string
        }
        Update: {
          acao_corretiva?: string | null
          categoria?: string | null
          comentario?: string | null
          created_at?: string
          estrelas_equipe?: number
          estrelas_estrutura?: number
          estrelas_treino?: number
          id?: string
          lead_id?: string | null
          lead_nome?: string | null
          nome?: string
          nota_nps?: number
          pontos_melhoria?: string[]
          pontos_positivos?: string[]
          prazo?: string | null
          status?: string
          tempo_aluno?: string
          unidade_id?: string | null
          unidade_nome?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_respostas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_respostas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      operacional_pendencias: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string | null
          gravidade: string | null
          id: string
          prazo: string | null
          registrado_por: string | null
          responsavel_solucao: string | null
          solucao: string | null
          source_id: string
          source_tabela: string
          status: string
          turno: string | null
          unidade: string
          updated_at: string
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          descricao?: string | null
          gravidade?: string | null
          id?: string
          prazo?: string | null
          registrado_por?: string | null
          responsavel_solucao?: string | null
          solucao?: string | null
          source_id: string
          source_tabela: string
          status?: string
          turno?: string | null
          unidade: string
          updated_at?: string
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string | null
          gravidade?: string | null
          id?: string
          prazo?: string | null
          registrado_por?: string | null
          responsavel_solucao?: string | null
          solucao?: string | null
          source_id?: string
          source_tabela?: string
          status?: string
          turno?: string | null
          unidade?: string
          updated_at?: string
        }
        Relationships: []
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
      profile_admin_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_admin_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      relatorio_diario_comercial_respostas: {
        Row: {
          atividades_realizadas: string[] | null
          cancelamentos: number | null
          cancelamentos_texto: string | null
          created_at: string
          data: string
          evasao: number | null
          experimentais_agendadas: number | null
          experimentais_realizadas: number | null
          fechamento_experimentais: string | null
          feedback_acao_descricao: string | null
          feedback_acao_tomada: boolean | null
          feedback_negativo: boolean | null
          feedback_negativo_descricao: string | null
          id: string
          inadimplentes: string | null
          inadimplentes_qtd: number | null
          inadimplentes_texto: string | null
          leads_recebidos: number | null
          motivo_nao_fechamento: string | null
          motivo_nao_fechamento_outro: string | null
          nao_renovados: string | null
          nao_renovados_qtd: number | null
          nao_renovados_texto: string | null
          nome: string
          novas_matriculas_texto: string | null
          novos_alunos: number | null
          observacoes: string | null
          ocorrencia: boolean | null
          ocorrencia_descricao: string | null
          pendencias: string | null
          plano_amanha: string | null
          precisa_suporte: boolean | null
          qtd_nao_fecharam: number | null
          renovacoes: number | null
          renovacoes_texto: string | null
          submitted_by: string | null
          suporte_descricao: string | null
          total_alunos_ativos: number | null
          unidade: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          atividades_realizadas?: string[] | null
          cancelamentos?: number | null
          cancelamentos_texto?: string | null
          created_at?: string
          data: string
          evasao?: number | null
          experimentais_agendadas?: number | null
          experimentais_realizadas?: number | null
          fechamento_experimentais?: string | null
          feedback_acao_descricao?: string | null
          feedback_acao_tomada?: boolean | null
          feedback_negativo?: boolean | null
          feedback_negativo_descricao?: string | null
          id?: string
          inadimplentes?: string | null
          inadimplentes_qtd?: number | null
          inadimplentes_texto?: string | null
          leads_recebidos?: number | null
          motivo_nao_fechamento?: string | null
          motivo_nao_fechamento_outro?: string | null
          nao_renovados?: string | null
          nao_renovados_qtd?: number | null
          nao_renovados_texto?: string | null
          nome: string
          novas_matriculas_texto?: string | null
          novos_alunos?: number | null
          observacoes?: string | null
          ocorrencia?: boolean | null
          ocorrencia_descricao?: string | null
          pendencias?: string | null
          plano_amanha?: string | null
          precisa_suporte?: boolean | null
          qtd_nao_fecharam?: number | null
          renovacoes?: number | null
          renovacoes_texto?: string | null
          submitted_by?: string | null
          suporte_descricao?: string | null
          total_alunos_ativos?: number | null
          unidade: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          atividades_realizadas?: string[] | null
          cancelamentos?: number | null
          cancelamentos_texto?: string | null
          created_at?: string
          data?: string
          evasao?: number | null
          experimentais_agendadas?: number | null
          experimentais_realizadas?: number | null
          fechamento_experimentais?: string | null
          feedback_acao_descricao?: string | null
          feedback_acao_tomada?: boolean | null
          feedback_negativo?: boolean | null
          feedback_negativo_descricao?: string | null
          id?: string
          inadimplentes?: string | null
          inadimplentes_qtd?: number | null
          inadimplentes_texto?: string | null
          leads_recebidos?: number | null
          motivo_nao_fechamento?: string | null
          motivo_nao_fechamento_outro?: string | null
          nao_renovados?: string | null
          nao_renovados_qtd?: number | null
          nao_renovados_texto?: string | null
          nome?: string
          novas_matriculas_texto?: string | null
          novos_alunos?: number | null
          observacoes?: string | null
          ocorrencia?: boolean | null
          ocorrencia_descricao?: string | null
          pendencias?: string | null
          plano_amanha?: string | null
          precisa_suporte?: boolean | null
          qtd_nao_fecharam?: number | null
          renovacoes?: number | null
          renovacoes_texto?: string | null
          submitted_by?: string | null
          suporte_descricao?: string | null
          total_alunos_ativos?: number | null
          unidade?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_diario_comercial_respostas_unidade_id_fkey"
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
      reuniao_anexos: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          id: string
          mime_type: string | null
          reuniao_id: string
          size_bytes: number | null
          unidade_id: string
          uploaded_by: string | null
          uploaded_by_name: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          mime_type?: string | null
          reuniao_id: string
          size_bytes?: number | null
          unidade_id: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          mime_type?: string | null
          reuniao_id?: string
          size_bytes?: number | null
          unidade_id?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reuniao_anexos_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      reuniao_comentarios: {
        Row: {
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at: string
          id: string
          reuniao_id: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          autor_id: string
          autor_nome: string
          conteudo: string
          created_at?: string
          id?: string
          reuniao_id: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          autor_id?: string
          autor_nome?: string
          conteudo?: string
          created_at?: string
          id?: string
          reuniao_id?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reunioes: {
        Row: {
          created_at: string
          criado_por: string | null
          data: string
          decisoes: string | null
          feedback: string | null
          id: string
          numeros_periodo: Json
          participantes: string[]
          pauta: string | null
          responsavel: string | null
          resumo: string | null
          status: string
          tipo: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data: string
          decisoes?: string | null
          feedback?: string | null
          id?: string
          numeros_periodo?: Json
          participantes?: string[]
          pauta?: string | null
          responsavel?: string | null
          resumo?: string | null
          status?: string
          tipo: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data?: string
          decisoes?: string | null
          feedback?: string | null
          id?: string
          numeros_periodo?: Json
          participantes?: string[]
          pauta?: string | null
          responsavel?: string | null
          resumo?: string | null
          status?: string
          tipo?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reunioes_encaminhamentos: {
        Row: {
          acao: string
          created_at: string
          id: string
          prazo: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          reuniao_id: string
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          acao: string
          created_at?: string
          id?: string
          prazo?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          reuniao_id: string
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          acao?: string
          created_at?: string
          id?: string
          prazo?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          reuniao_id?: string
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reunioes_encaminhamentos_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "reunioes"
            referencedColumns: ["id"]
          },
        ]
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
      rotina_webhook_auditoria: {
        Row: {
          auth_method: string | null
          autorizado: boolean
          canal_origem: string | null
          created_at: string
          id: string
          instance_id: string | null
          message_id: string | null
          motivo_bloqueio: string | null
          payload_resumo: Json | null
          rotina_id: string | null
          status_aplicado: string | null
          telefone_mascarado: string | null
        }
        Insert: {
          auth_method?: string | null
          autorizado: boolean
          canal_origem?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          message_id?: string | null
          motivo_bloqueio?: string | null
          payload_resumo?: Json | null
          rotina_id?: string | null
          status_aplicado?: string | null
          telefone_mascarado?: string | null
        }
        Update: {
          auth_method?: string | null
          autorizado?: boolean
          canal_origem?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          message_id?: string | null
          motivo_bloqueio?: string | null
          payload_resumo?: Json | null
          rotina_id?: string | null
          status_aplicado?: string | null
          telefone_mascarado?: string | null
        }
        Relationships: []
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
      unidade_whatsapp_config: {
        Row: {
          ativo: boolean
          created_at: string
          grupo_anamnese_id: string | null
          grupo_anamnese_nome: string | null
          grupo_contas_pagar_id: string | null
          grupo_contas_pagar_nome: string | null
          grupo_fu_id: string | null
          grupo_fu_nome: string | null
          telefone_recepcao: string | null
          unidade_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          grupo_anamnese_id?: string | null
          grupo_anamnese_nome?: string | null
          grupo_contas_pagar_id?: string | null
          grupo_contas_pagar_nome?: string | null
          grupo_fu_id?: string | null
          grupo_fu_nome?: string | null
          telefone_recepcao?: string | null
          unidade_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          grupo_anamnese_id?: string | null
          grupo_anamnese_nome?: string | null
          grupo_contas_pagar_id?: string | null
          grupo_contas_pagar_nome?: string | null
          grupo_fu_id?: string | null
          grupo_fu_nome?: string | null
          telefone_recepcao?: string | null
          unidade_id?: string
          updated_at?: string
        }
        Relationships: []
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
      whatsapp_conversations: {
        Row: {
          contact_name: string | null
          created_at: string | null
          first_inbound_at: string | null
          first_response_at: string | null
          id: string
          is_cliente: boolean | null
          is_linked_to_lead: boolean | null
          last_message_at: string | null
          last_message_direction: string | null
          last_message_text: string | null
          lead_id: string | null
          phone: string
          phone_normalized: string
          status_conversa: string | null
          unidade_id: string
          updated_at: string | null
        }
        Insert: {
          contact_name?: string | null
          created_at?: string | null
          first_inbound_at?: string | null
          first_response_at?: string | null
          id?: string
          is_cliente?: boolean | null
          is_linked_to_lead?: boolean | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          lead_id?: string | null
          phone: string
          phone_normalized: string
          status_conversa?: string | null
          unidade_id: string
          updated_at?: string | null
        }
        Update: {
          contact_name?: string | null
          created_at?: string | null
          first_inbound_at?: string | null
          first_response_at?: string | null
          id?: string
          is_cliente?: boolean | null
          is_linked_to_lead?: boolean | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          lead_id?: string | null
          phone?: string
          phone_normalized?: string
          status_conversa?: string | null
          unidade_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_envios_log: {
        Row: {
          canal: string
          created_at: string
          destino: string | null
          erro_msg: string | null
          funcao: string
          id: string
          motivo_skip: string | null
          resposta_completa: Json | null
          status_envio: string | null
          sucesso: boolean
          tipo_destino: string | null
          unidade_id: string | null
          zapi_status_code: number | null
        }
        Insert: {
          canal?: string
          created_at?: string
          destino?: string | null
          erro_msg?: string | null
          funcao: string
          id?: string
          motivo_skip?: string | null
          resposta_completa?: Json | null
          status_envio?: string | null
          sucesso?: boolean
          tipo_destino?: string | null
          unidade_id?: string | null
          zapi_status_code?: number | null
        }
        Update: {
          canal?: string
          created_at?: string
          destino?: string | null
          erro_msg?: string | null
          funcao?: string
          id?: string
          motivo_skip?: string | null
          resposta_completa?: Json | null
          status_envio?: string | null
          sucesso?: boolean
          tipo_destino?: string | null
          unidade_id?: string | null
          zapi_status_code?: number | null
        }
        Relationships: []
      }
      whatsapp_idempotencia: {
        Row: {
          canal: string | null
          chave: string
          created_at: string
          destino: string | null
          expires_at: string
          funcao: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          canal?: string | null
          chave: string
          created_at?: string
          destino?: string | null
          expires_at?: string
          funcao: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          canal?: string | null
          chave?: string
          created_at?: string
          destino?: string | null
          expires_at?: string
          funcao?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          contact_name: string | null
          created_at: string | null
          direction: string
          first_response_at: string | null
          id: string
          lead_id: string | null
          message_id: string | null
          message_text: string | null
          message_type: string | null
          phone: string
          phone_normalized: string
          received_at: string | null
          replied_at: string | null
          status: string | null
          timestamp: string | null
          unidade_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string | null
          direction: string
          first_response_at?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          phone: string
          phone_normalized: string
          received_at?: string | null
          replied_at?: string | null
          status?: string | null
          timestamp?: string | null
          unidade_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string | null
          direction?: string
          first_response_at?: string | null
          id?: string
          lead_id?: string | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string | null
          phone?: string
          phone_normalized?: string
          received_at?: string | null
          replied_at?: string | null
          status?: string | null
          timestamp?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_operacional_atendimentos: {
        Row: {
          data: string | null
          formulario_id: string | null
          origem: string | null
          pendente_revisao: boolean | null
          quantidade: number | null
          responsavel: string | null
          treinador: string | null
          turno: string | null
          unidade: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_bulk_update_cronograma: {
        Args: {
          p_add_dias?: number[]
          p_delete?: boolean
          p_duplicate?: boolean
          p_ids: string[]
          p_patch?: Json
          p_replace_dias?: number[]
        }
        Returns: Json
      }
      admin_cleanup_duplicate_leads: {
        Args: { lead_ids: string[] }
        Returns: number
      }
      admin_list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      admin_list_cronograma_historico: {
        Args: { p_limit?: number }
        Returns: {
          atividade_id: string
          atividade_titulo: string
          bulk_operation_id: string
          campo: string
          created_at: string
          id: string
          user_name: string
          valor_anterior: string
          valor_novo: string
        }[]
      }
      admin_standardize_origem: {
        Args: { new_value: string; old_value: string }
        Returns: number
      }
      admin_standardize_treinador: {
        Args: { new_value: string; old_value: string }
        Returns: number
      }
      admin_toggle_cron_job: {
        Args: { p_active: boolean; p_jobid: number }
        Returns: undefined
      }
      admin_update_cadastrador: {
        Args: { new_name: string; old_name: string }
        Returns: number
      }
      admin_update_cron_schedule: {
        Args: { p_jobid: number; p_schedule: string }
        Returns: undefined
      }
      can_manage_contas_pagar: { Args: { _user_id: string }; Returns: boolean }
      canonical_phone: { Args: { phone: string }; Returns: string }
      claim_whatsapp_envio: {
        Args: {
          p_canal?: string
          p_chave: string
          p_destino?: string
          p_funcao: string
          p_ttl_minutes?: number
        }
        Returns: boolean
      }
      generate_follow_ups_for_lead: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      get_cron_secret: { Args: never; Returns: string }
      get_cronograma_funcionarios_full: {
        Args: { p_unidade_id: string }
        Returns: {
          ativo: boolean
          cargo: string | null
          created_at: string
          id: string
          nome: string
          setor: string
          telefone: string | null
          turno: string
          unidade_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cronograma_funcionarios"
          isOneToOne: false
          isSetofReturn: true
        }
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
      migrar_lead_unidade: {
        Args: {
          p_lead_id: string
          p_motivo?: string
          p_unidade_destino: string
        }
        Returns: Json
      }
      normalize_cronograma_tipo: { Args: { p_titulo: string }; Returns: string }
      normalize_phone: { Args: { phone: string }; Returns: string }
      parse_atendimentos: {
        Args: { p_text: string }
        Returns: {
          quantidade: number
          treinador: string
        }[]
      }
      release_whatsapp_envio: { Args: { p_chave: string }; Returns: undefined }
      reservar_envio_conta: {
        Args: { p_conta_id: string; p_tipo: string }
        Returns: {
          conta_id: string
          created_at: string
          erro_msg: string | null
          grupo_destino: string | null
          id: string
          instancia_id: string | null
          mensagem_enviada: string | null
          proxima_tentativa_em: string | null
          status: string
          tentativas: number
          tipo_envio: string
          ultima_tentativa_em: string | null
          unidade_id: string
          updated_at: string
          zapi_message_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "contas_pagar_envios"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_nps_resposta: {
        Args: {
          p_comentario?: string
          p_estrelas_equipe: number
          p_estrelas_estrutura: number
          p_estrelas_treino: number
          p_nome: string
          p_nota_nps: number
          p_pontos_melhoria: string[]
          p_pontos_positivos: string[]
          p_tempo_aluno: string
          p_unidade_nome: string
          p_whatsapp: string
        }
        Returns: string
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_can_access_conta_pagar_doc: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_reuniao_anexo: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_rotina_comprovante_by_unidade: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
      user_can_insert_rotina_comprovante: {
        Args: { _object_name: string; _user_id: string }
        Returns: boolean
      }
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

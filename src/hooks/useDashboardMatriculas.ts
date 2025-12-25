import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { MatriculaItem } from '@/components/dashboard/constants';
import { mapToLead, mapToInteracao } from '@/utils/dashboardMappers';
import { format } from 'date-fns';

interface UseDashboardMatriculasReturn {
  matriculasDetalhadas: MatriculaItem[];
  loading: boolean;
  fetchMatriculas: (startDate: Date, endDate: Date) => Promise<void>;
}

export function useDashboardMatriculas(): UseDashboardMatriculasReturn {
  const { unidadeAtual } = useUnidade();
  
  const [matriculasDetalhadas, setMatriculasDetalhadas] = useState<MatriculaItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMatriculas = useCallback(async (startDate: Date, endDate: Date) => {
    if (!unidadeAtual) return;
    
    setLoading(true);
    try {
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');

      const { data: matriculasData } = await supabase
        .from('interacoes')
        .select(`
          id, lead_id, data_fechamento, atendido_por, responsavel_fechamento,
          treinador_responsavel, plano_escolhido, valor_plano, comissao_comercial,
          comissao_recepcao, comissao_cadastrador,
          leads (id, nome, telefone, origem, status_funil, cadastrado_por, created_by, ativo)
        `)
        .eq('fechou_matricula', true)
        .eq('unidade_id', unidadeAtual.id)
        .gte('data_fechamento', startDateStr)
        .lte('data_fechamento', endDateStr)
        .order('data_fechamento', { ascending: false });

      if (!matriculasData || matriculasData.length === 0) {
        setMatriculasDetalhadas([]);
        return;
      }

      const matriculaItems: MatriculaItem[] = [];
      matriculasData.forEach((item: any) => {
        if (!item.leads) return;
        
        const lead = mapToLead({
          ...item.leads,
          email: null,
          plano_escolhido: null,
          data_aula_experimental: null,
          hora_aula_experimental: null,
          observacoes: null,
          atendido_por: null,
          user_id: null,
          created_at: '',
          updated_at: '',
          follow_up_whatsapp_enviado: false,
          follow_up_enviado_em: null,
          follow_up_responsavel: null,
          motivo_perda: null,
          data_perda: null,
        });
        
        const interacao = mapToInteracao({
          id: item.id,
          lead_id: item.lead_id,
          data_fechamento: item.data_fechamento,
          atendido_por: item.atendido_por,
          responsavel_fechamento: item.responsavel_fechamento,
          treinador_responsavel: item.treinador_responsavel,
          plano_escolhido: item.plano_escolhido,
          valor_plano: item.valor_plano,
          comissao_comercial: item.comissao_comercial,
          comissao_recepcao: item.comissao_recepcao,
          comissao_cadastrador: item.comissao_cadastrador,
          tipo: '',
          descricao: null,
          data_interacao: '',
          created_at: '',
          created_by: null,
          atendido_por_tipo: null,
          agendou_experimental: false,
          data_experimental: null,
          hora_experimental: null,
          compareceu: null,
          confirmado: null,
          reagendou: false,
          fechou_matricula: true,
          cadastrado_por: null,
          treinador_experimental: null,
          origem_fechamento: null,
          quem_agendou: null,
          tipo_atendimento: null,
          data_avaliacao: null,
          hora_avaliacao: null,
          status_avaliacao: null,
        });
        
        matriculaItems.push({ lead, interacao });
      });

      setMatriculasDetalhadas(matriculaItems);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  return {
    matriculasDetalhadas,
    loading,
    fetchMatriculas,
  };
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';

export interface CronogramaEnvio {
  id: string;
  atividade_id: string | null;
  formulario_id: string;
  funcionario_id: string;
  unidade_id: string;
  status: string;
  enviado_em: string | null;
  respondido_em: string | null;
  resposta_id: string | null;
  created_at: string;
}

export function useCronogramaEnvios() {
  const { unidadeId, hasUnidade } = useUnidadeFilter();

  const { data: envios = [], isLoading } = useQuery({
    queryKey: ['cronograma-envios', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      const { data, error } = await supabase
        .from('cronograma_envios')
        .select('*, cronograma_funcionarios(nome), formularios(titulo)')
        .eq('unidade_id', unidadeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: hasUnidade,
  });

  const totalEnviados = envios.filter(e => e.status !== 'pendente').length;
  const totalRespondidos = envios.filter(e => e.status === 'respondido').length;
  const totalPendentes = envios.filter(e => e.status === 'pendente' || e.status === 'enviado').length;
  const taxaResposta = totalEnviados > 0 ? Math.round((totalRespondidos / totalEnviados) * 100) : 0;

  return {
    envios,
    isLoading,
    totalEnviados,
    totalRespondidos,
    totalPendentes,
    taxaResposta,
  };
}

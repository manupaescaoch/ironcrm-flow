import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';

export interface PagamentoConfirmado {
  id: string;
  interacaoId: string;
  leadId: string;
  dataVencimento: Date;
  dataConfirmacao: Date;
  confirmadoPor: string | null;
  observacao: string | null;
}

export function usePagamentosData() {
  const { unidadeAtual } = useUnidade();

  const { data: pagamentos, isLoading, refetch } = useQuery({
    queryKey: ['pagamentos-mensais', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];

      const { data, error } = await supabase
        .from('pagamentos_mensais')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id,
        interacaoId: p.interacao_id,
        leadId: p.lead_id,
        dataVencimento: new Date(p.data_vencimento),
        dataConfirmacao: new Date(p.data_confirmacao),
        confirmadoPor: p.confirmado_por,
        observacao: p.observacao,
      }));
    },
    enabled: !!unidadeAtual?.id,
  });

  // Cria um Set de interacao_id + data_vencimento para verificação rápida
  const pagamentosConfirmadosSet = new Set(
    (pagamentos || []).map((p) => `${p.interacaoId}_${p.dataVencimento.toISOString().split('T')[0]}`)
  );

  const verificarPagamentoConfirmado = (interacaoId: string, dataVencimento: Date): boolean => {
    const key = `${interacaoId}_${dataVencimento.toISOString().split('T')[0]}`;
    return pagamentosConfirmadosSet.has(key);
  };

  return {
    pagamentos: pagamentos || [],
    isLoading,
    refetch,
    verificarPagamentoConfirmado,
  };
}

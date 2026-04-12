import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Lead, Interacao } from '@/types/database';
import { useToast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';

interface UseExecutivoDataReturn {
  leads: Lead[];
  interacoes: Interacao[];
  loading: boolean;
  fetchData: (dataInicio: string, dataFim: string) => Promise<void>;
}

export function useExecutivoData(): UseExecutivoDataReturn {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();

  const fetchData = useCallback(async (dataInicio: string, dataFim: string) => {
    if (!unidadeAtual) return;
    
    setLoading(true);

    // Fetch leads in period filtered by unidade
    let leadsQuery = supabase
      .from('leads')
      .select('*')
      .eq('unidade_id', unidadeAtual.id)
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim + 'T23:59:59')
      .eq('ativo', true);

    const { data: leadsData, error: leadsError } = await leadsQuery;

    if (leadsError) {
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Fetch all interacoes in period filtered by unidade
    const { data: interacoesData, error: interacoesError } = await supabase
      .from('interacoes')
      .select('*')
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_interacao', dataInicio)
      .lte('data_interacao', dataFim + 'T23:59:59');

    if (interacoesError) {
      toast({ title: 'Erro ao carregar interações', variant: 'destructive' });
      setLoading(false);
      return;
    }

    setLeads((leadsData || []) as unknown as Lead[]);
    setInteracoes((interacoesData || []) as unknown as Interacao[]);
    setLoading(false);
  }, [toast, unidadeAtual]);

  return {
    leads,
    interacoes,
    loading,
    fetchData,
  };
}

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';

export interface FollowUpMatriculadoItem {
  id: string;
  lead_id: string;
  tipo: string; // 'M+7' | 'M+30' (genérico)
  data_referencia: string;
  data_prevista: string;
  status: string;
  lead: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
  };
}

export function useFollowUpsMatriculados() {
  const { unidadeAtual } = useUnidade();
  const [items, setItems] = useState<FollowUpMatriculadoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!unidadeAtual) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_ups')
        .select(`
          id, lead_id, tipo, data_referencia, data_prevista, status,
          leads!inner (id, nome, telefone, email, is_matriculado, ativo)
        `)
        .eq('unidade_id', unidadeAtual.id)
        .eq('status', 'pendente')
        .in('tipo', ['M+7', 'M+30'])
        .order('data_prevista', { ascending: true });

      if (error) {
        console.error('Erro ao buscar follow-ups de matriculados:', error);
        return;
      }

      const mapped: FollowUpMatriculadoItem[] = (data || [])
        .filter((row: any) => row.leads && row.leads.is_matriculado === true && row.leads.ativo !== false)
        .map((row: any) => ({
          id: row.id,
          lead_id: row.lead_id,
          tipo: row.tipo,
          data_referencia: row.data_referencia,
          data_prevista: row.data_prevista,
          status: row.status,
          lead: {
            id: row.leads.id,
            nome: row.leads.nome,
            telefone: row.leads.telefone,
            email: row.leads.email,
          },
        }));

      setItems(mapped);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime
  useEffect(() => {
    if (!unidadeAtual) return;
    const channel = supabase
      .channel('follow_ups_matriculados_realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'follow_ups',
        filter: `unidade_id=eq.${unidadeAtual.id}`,
      }, () => fetchItems())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [unidadeAtual?.id, fetchItems]);

  // Urgent = vencidos ou hoje
  const urgentItems = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    return items.filter(i => new Date(i.data_prevista) <= hoje);
  }, [items]);

  return { items, urgentItems, loading, refetch: fetchItems };
}

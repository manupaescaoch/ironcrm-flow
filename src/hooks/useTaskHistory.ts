import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TaskHistoryEntry {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
}

const CAMPO_LABELS: Record<string, string> = {
  status: 'Status',
  prioridade: 'Prioridade',
  responsavel: 'Responsável',
  prazo: 'Prazo',
  titulo: 'Título',
  setor: 'Setor',
};

const STATUS_LABELS: Record<string, string> = {
  a_fazer: 'A Fazer',
  em_andamento: 'Em Andamento',
  aguardando: 'Aguardando',
  concluida: 'Concluída',
};

const PRIORIDADE_LABELS: Record<string, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export function useTaskHistory(taskId: string | null) {
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!taskId) {
      setHistory([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_history')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistory((data as TaskHistoryEntry[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatValue = (campo: string, value: string | null): string => {
    if (!value) return '-';
    
    if (campo === 'status') {
      return STATUS_LABELS[value] || value;
    }
    if (campo === 'prioridade') {
      return PRIORIDADE_LABELS[value] || value;
    }
    return value;
  };

  const getCampoLabel = (campo: string): string => {
    return CAMPO_LABELS[campo] || campo;
  };

  return {
    history,
    loading,
    refetch: fetchHistory,
    formatValue,
    getCampoLabel,
  };
}

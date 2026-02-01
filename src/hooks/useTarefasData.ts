import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useToast } from '@/hooks/use-toast';

export interface Task {
  id: string;
  titulo: string;
  descricao: string | null;
  responsavel: string;
  setor: string;
  prioridade: 'alta' | 'media' | 'baixa';
  status: 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluida';
  prazo: string | null;
  unidade_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  concluida_em: string | null;
  arquivada: boolean;
  recorrencia: string | null;
  recorrencia_fim: string | null;
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'concluida_em' | 'arquivada' | 'recorrencia' | 'recorrencia_fim'>;
export type TaskUpdate = Partial<TaskInsert> & { arquivada?: boolean };

export const SETORES = [
  'Financeiro',
  'Treinadores',
  'Recepção',
  'Marketing',
  'Limpeza/Manutenção',
  'Coordenação',
] as const;

export const PRIORIDADES = [
  { value: 'alta', label: 'Alta', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  { value: 'media', label: 'Média', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  { value: 'baixa', label: 'Baixa', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
] as const;

export const STATUS_CONFIG = [
  { value: 'a_fazer', label: 'A Fazer', color: 'bg-blue-500', headerColor: 'bg-blue-500/10 border-blue-500/30' },
  { value: 'em_andamento', label: 'Em Andamento', color: 'bg-amber-500', headerColor: 'bg-amber-500/10 border-amber-500/30' },
  { value: 'aguardando', label: 'Aguardando', color: 'bg-orange-500', headerColor: 'bg-orange-500/10 border-orange-500/30' },
  { value: 'concluida', label: 'Concluída', color: 'bg-green-500', headerColor: 'bg-green-500/10 border-green-500/30' },
] as const;

export function useTarefasData() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { unidadeAtual } = useUnidade();
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    if (!unidadeAtual) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTasks((data as Task[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar tarefas:', err);
      setError(err.message);
      toast({
        title: 'Erro ao carregar tarefas',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual, toast]);

  const createTask = useCallback(async (task: TaskInsert) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Tarefa criada',
        description: 'A tarefa foi criada com sucesso.',
      });

      return data as Task;
    } catch (err: any) {
      console.error('Erro ao criar tarefa:', err);
      toast({
        title: 'Erro ao criar tarefa',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  }, [toast]);

  const updateTask = useCallback(async (id: string, updates: TaskUpdate) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return data as Task;
    } catch (err: any) {
      console.error('Erro ao atualizar tarefa:', err);
      toast({
        title: 'Erro ao atualizar tarefa',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  }, [toast]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Tarefa excluída',
        description: 'A tarefa foi excluída com sucesso.',
      });
    } catch (err: any) {
      console.error('Erro ao excluir tarefa:', err);
      toast({
        title: 'Erro ao excluir tarefa',
        description: err.message,
        variant: 'destructive',
      });
      throw err;
    }
  }, [toast]);

  const updateTaskStatus = useCallback(async (id: string, status: Task['status']) => {
    return updateTask(id, { status });
  }, [updateTask]);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime subscription
  useEffect(() => {
    if (!unidadeAtual) return;

    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks((prev) => [payload.new as Task, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks((prev) =>
              prev.map((task) =>
                task.id === payload.new.id ? (payload.new as Task) : task
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) =>
              prev.filter((task) => task.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unidadeAtual]);

  return {
    tasks,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
  };
}

import { useState, useEffect, useCallback } from 'react';
import { addDays, addMonths, nextDay } from 'date-fns';
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
  hora_prazo: string | null;
  unidade_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  concluida_em: string | null;
  arquivada: boolean;
  recorrencia: string | null;
  recorrencia_fim: string | null;
  notificado_24h: boolean;
  notificado_prazo: boolean;
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'concluida_em' | 'arquivada' | 'notificado_24h' | 'notificado_prazo'> & { setor?: string };
export type TaskUpdate = Partial<TaskInsert> & { arquivada?: boolean };

// SETORES removido - campo agora opcional

export const PRIORIDADES = [
  { value: 'alta', label: 'Alta', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  { value: 'media', label: 'Média', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  { value: 'baixa', label: 'Baixa', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
] as const;

export const RECORRENCIA_OPTIONS = [
  { value: '', label: 'Nenhuma' },
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
] as const;

export const DIAS_SEMANA = [
  { value: 'seg', label: 'Seg' },
  { value: 'ter', label: 'Ter' },
  { value: 'qua', label: 'Qua' },
  { value: 'qui', label: 'Qui' },
  { value: 'sex', label: 'Sex' },
  { value: 'sab', label: 'Sáb' },
  { value: 'dom', label: 'Dom' },
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
        .order('prazo', { ascending: true, nullsFirst: false })
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

  const sendOpsNotification = useCallback(async (
    taskId: string, 
    taskTitle: string, 
    responsavelName: string, 
    tipo: 'nova_tarefa' | 'tarefa_atualizada',
    creatorName?: string,
    taskDescription?: string | null,
    unidadeNome?: string,
    prazo?: string | null,
    horaPrazo?: string | null
  ) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) return;

      await supabase.functions.invoke('ops-notify-task', {
        body: {
          task_id: taskId,
          task_title: taskTitle,
          task_description: taskDescription,
          responsavel_name: responsavelName,
          tipo,
          creator_name: creatorName,
          unidade_nome: unidadeNome,
          prazo,
          hora_prazo: horaPrazo,
        },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
    } catch (err) {
      // Silently fail - notification is best effort
      console.log('Notificação EVO OPS ignorada:', err);
    }
  }, []);

  const createTask = useCallback(async (task: TaskInsert) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const creatorName = sessionData.session?.user?.user_metadata?.name || 'Sistema';

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

      // Notificar via EVO OPS
      if (data) {
        sendOpsNotification(data.id, data.titulo, task.responsavel, 'nova_tarefa', creatorName, data.descricao, unidadeAtual?.nome, data.prazo, data.hora_prazo);
      }

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
  }, [toast, sendOpsNotification, unidadeAtual]);

  const updateTask = useCallback(async (id: string, updates: TaskUpdate, previousResponsavel?: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Se o responsável mudou, notificar o novo responsável via EVO OPS
      if (updates.responsavel && previousResponsavel && updates.responsavel !== previousResponsavel) {
        sendOpsNotification(id, data.titulo, updates.responsavel, 'tarefa_atualizada', undefined, data.descricao, unidadeAtual?.nome, data.prazo, data.hora_prazo);
      }

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
  }, [toast, sendOpsNotification, unidadeAtual]);

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

  const createNextRecurringTask = useCallback(async (completedTask: Task) => {
    if (!completedTask.recorrencia || !completedTask.prazo) return;

    const currentDate = new Date(completedTask.prazo);
    let nextDate: Date | null = null;
    const recorrencia = completedTask.recorrencia;

    if (recorrencia === 'diaria') {
      nextDate = addDays(currentDate, 1);
    } else if (recorrencia === 'quinzenal') {
      nextDate = addDays(currentDate, 15);
    } else if (recorrencia === 'mensal') {
      nextDate = addMonths(currentDate, 1);
    } else if (recorrencia.startsWith('semanal:')) {
      const diasMap: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };
      const dias = recorrencia.replace('semanal:', '').split(',').map(d => diasMap[d]).filter(d => d !== undefined);
      if (dias.length > 0) {
        // Find next matching day after current date
        let closest: Date | null = null;
        for (const dayNum of dias) {
          const candidate = nextDay(currentDate, dayNum as 0 | 1 | 2 | 3 | 4 | 5 | 6);
          if (!closest || candidate < closest) closest = candidate;
        }
        nextDate = closest;
      }
    }

    if (!nextDate) return;

    // Check if past recorrencia_fim
    if (completedTask.recorrencia_fim) {
      const fimDate = new Date(completedTask.recorrencia_fim);
      if (nextDate > fimDate) return;
    }

    const { format } = await import('date-fns');
    const newTaskData: TaskInsert = {
      titulo: completedTask.titulo,
      descricao: completedTask.descricao,
      responsavel: completedTask.responsavel,
      setor: completedTask.setor,
      prioridade: completedTask.prioridade,
      status: 'a_fazer',
      prazo: format(nextDate, 'yyyy-MM-dd'),
      hora_prazo: completedTask.hora_prazo,
      unidade_id: completedTask.unidade_id,
      recorrencia: completedTask.recorrencia,
      recorrencia_fim: completedTask.recorrencia_fim,
    };

    try {
      await supabase.from('tasks').insert(newTaskData);
    } catch (err) {
      console.error('Erro ao criar próxima tarefa recorrente:', err);
    }
  }, []);

  const updateTaskStatus = useCallback(async (id: string, status: Task['status']) => {
    const result = await updateTask(id, { status });
    
    // If marking as completed and task is recurring, create next occurrence
    if (status === 'concluida' && result) {
      const completedTask = tasks.find(t => t.id === id);
      if (completedTask?.recorrencia) {
        await createNextRecurringTask({ ...completedTask, status: 'concluida' });
        toast({ title: 'Próxima ocorrência criada', description: 'A tarefa recorrente foi reagendada automaticamente.' });
      }
    }
    
    return result;
  }, [updateTask, tasks, createNextRecurringTask, toast]);

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

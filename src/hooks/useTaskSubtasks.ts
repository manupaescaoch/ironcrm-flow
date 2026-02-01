import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TaskSubtask {
  id: string;
  task_id: string;
  titulo: string;
  concluido: boolean;
  ordem: number;
  created_at: string;
}

export function useTaskSubtasks(taskId: string | null) {
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSubtasks = useCallback(async () => {
    if (!taskId) {
      setSubtasks([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setSubtasks((data as TaskSubtask[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar subtarefas:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const addSubtask = useCallback(
    async (titulo: string) => {
      if (!taskId) return;

      const maxOrdem = subtasks.length > 0 
        ? Math.max(...subtasks.map((s) => s.ordem)) + 1 
        : 0;

      try {
        const { error } = await supabase.from('task_subtasks').insert({
          task_id: taskId,
          titulo: titulo.toUpperCase(),
          ordem: maxOrdem,
        });

        if (error) throw error;
      } catch (err: any) {
        console.error('Erro ao adicionar subtarefa:', err);
        toast({
          title: 'Erro ao adicionar item',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [taskId, subtasks, toast]
  );

  const toggleSubtask = useCallback(
    async (subtaskId: string, concluido: boolean) => {
      try {
        const { error } = await supabase
          .from('task_subtasks')
          .update({ concluido })
          .eq('id', subtaskId);

        if (error) throw error;
      } catch (err: any) {
        console.error('Erro ao atualizar subtarefa:', err);
        toast({
          title: 'Erro ao atualizar item',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast]
  );

  const deleteSubtask = useCallback(
    async (subtaskId: string) => {
      try {
        const { error } = await supabase
          .from('task_subtasks')
          .delete()
          .eq('id', subtaskId);

        if (error) throw error;
      } catch (err: any) {
        console.error('Erro ao excluir subtarefa:', err);
        toast({
          title: 'Erro ao excluir item',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast]
  );

  const updateSubtaskTitle = useCallback(
    async (subtaskId: string, titulo: string) => {
      try {
        const { error } = await supabase
          .from('task_subtasks')
          .update({ titulo: titulo.toUpperCase() })
          .eq('id', subtaskId);

        if (error) throw error;
      } catch (err: any) {
        console.error('Erro ao atualizar título:', err);
        throw err;
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  // Realtime subscription
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`task-subtasks-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_subtasks',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSubtasks((prev) => [...prev, payload.new as TaskSubtask].sort((a, b) => a.ordem - b.ordem));
          } else if (payload.eventType === 'UPDATE') {
            setSubtasks((prev) =>
              prev.map((s) => (s.id === payload.new.id ? (payload.new as TaskSubtask) : s))
            );
          } else if (payload.eventType === 'DELETE') {
            setSubtasks((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  // Computed values
  const progress = subtasks.length > 0
    ? { completed: subtasks.filter((s) => s.concluido).length, total: subtasks.length }
    : null;

  return {
    subtasks,
    loading,
    progress,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    updateSubtaskTitle,
    refetch: fetchSubtasks,
  };
}

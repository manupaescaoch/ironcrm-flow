import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string;
  content: string;
  created_at: string;
}

export function useTaskComments(taskId: string | null) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchComments = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments((data as TaskComment[]) || []);
    } catch (err: any) {
      console.error('Erro ao buscar comentários:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const addComment = useCallback(
    async (content: string) => {
      if (!taskId || !user) return;

      const userName = user.user_metadata?.name || user.email || 'Usuário';

      try {
        const { error } = await supabase.from('task_comments').insert({
          task_id: taskId,
          user_id: user.id,
          user_name: userName.toUpperCase(),
          content: content.toUpperCase(),
        });

        if (error) throw error;

        toast({
          title: 'Comentário adicionado',
          description: 'Seu comentário foi salvo com sucesso.',
        });
      } catch (err: any) {
        console.error('Erro ao adicionar comentário:', err);
        toast({
          title: 'Erro ao adicionar comentário',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [taskId, user, toast]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      try {
        const { error } = await supabase
          .from('task_comments')
          .delete()
          .eq('id', commentId);

        if (error) throw error;

        toast({
          title: 'Comentário excluído',
        });
      } catch (err: any) {
        console.error('Erro ao excluir comentário:', err);
        toast({
          title: 'Erro ao excluir comentário',
          description: err.message,
          variant: 'destructive',
        });
        throw err;
      }
    },
    [toast]
  );

  // Initial fetch
  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!taskId) return;

    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setComments((prev) => [payload.new as TaskComment, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) =>
              prev.filter((c) => c.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  return {
    comments,
    loading,
    addComment,
    deleteComment,
    refetch: fetchComments,
  };
}

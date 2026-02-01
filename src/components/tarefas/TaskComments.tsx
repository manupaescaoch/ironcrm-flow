import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskComments, TaskComment } from '@/hooks/useTaskComments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { comments, loading, addComment, deleteComment } = useTaskComments(taskId);
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSending(true);
    try {
      await addComment(newComment.trim());
      setNewComment('');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (comment: TaskComment) => {
    if (confirm('Excluir este comentário?')) {
      await deleteComment(comment.id);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-amber-500',
      'bg-red-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <Textarea
          placeholder="Escreva um comentário..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
          className="resize-none"
        />
        <Button type="submit" size="icon" disabled={sending || !newComment.trim()}>
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>

      {/* Comments list */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        {comments.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhum comentário ainda
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-3 p-3 rounded-lg bg-muted/50"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0',
                    getAvatarColor(comment.user_name)
                  )}
                >
                  {getInitials(comment.user_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">
                      {comment.user_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {format(new Date(comment.created_at), "dd/MM 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
                {comment.user_id === user?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(comment)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

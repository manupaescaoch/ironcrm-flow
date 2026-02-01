import { useState } from 'react';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskSubtasks, TaskSubtask } from '@/hooks/useTaskSubtasks';
import { cn } from '@/lib/utils';

interface TaskSubtasksProps {
  taskId: string;
}

export function TaskSubtasks({ taskId }: TaskSubtasksProps) {
  const { subtasks, loading, progress, addSubtask, toggleSubtask, deleteSubtask } =
    useTaskSubtasks(taskId);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setAdding(true);
    try {
      await addSubtask(newTitle.trim());
      setNewTitle('');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (subtask: TaskSubtask) => {
    await toggleSubtask(subtask.id, !subtask.concluido);
  };

  const handleDelete = async (subtask: TaskSubtask) => {
    await deleteSubtask(subtask.id);
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
      {/* Progress indicator */}
      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">
              {progress.completed}/{progress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${(progress.completed / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Add subtask form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <Input
          placeholder="Novo item do checklist..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <Button type="submit" size="icon" disabled={adding || !newTitle.trim()}>
          {adding ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </Button>
      </form>

      {/* Subtasks list */}
      <ScrollArea className="flex-1 -mx-1 px-1">
        {subtasks.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhum item no checklist
          </div>
        ) : (
          <div className="space-y-2">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors',
                  subtask.concluido && 'bg-muted/50'
                )}
              >
                <Checkbox
                  checked={subtask.concluido}
                  onCheckedChange={() => handleToggle(subtask)}
                />
                <span
                  className={cn(
                    'flex-1 text-sm',
                    subtask.concluido && 'line-through text-muted-foreground'
                  )}
                >
                  {subtask.titulo}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(subtask)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Compact version for TarefaCard
interface TaskSubtasksProgressProps {
  taskId: string;
}

export function TaskSubtasksProgress({ taskId }: TaskSubtasksProgressProps) {
  const { progress } = useTaskSubtasks(taskId);

  if (!progress || progress.total === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            progress.completed === progress.total ? 'bg-green-500' : 'bg-primary'
          )}
          style={{
            width: `${(progress.completed / progress.total) * 100}%`,
          }}
        />
      </div>
      <span>
        {progress.completed}/{progress.total}
      </span>
    </div>
  );
}

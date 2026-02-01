import { useState, useCallback, useMemo } from 'react';
import { Task, STATUS_CONFIG } from '@/hooks/useTarefasData';
import { TarefaCard } from './TarefaCard';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sortTasksByPriorityAndDeadline } from './TarefasFilters';

interface TarefasKanbanProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: Task['status']) => Promise<void>;
}

export function TarefasKanban({
  tasks,
  onTaskClick,
  onStatusChange,
}: TarefasKanbanProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const getTasksByStatus = useCallback(
    (status: string) => {
      const filtered = tasks.filter((task) => task.status === status && !task.arquivada);
      return sortTasksByPriorityAndDeadline(filtered);
    },
    [tasks]
  );

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    setDragOverColumn(null);

    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    await onStatusChange(taskId, newStatus);
  };

  return (
    <div className="flex gap-3 h-[calc(100vh-340px)] min-h-[400px] overflow-x-auto pb-2">
      {STATUS_CONFIG.map((statusConfig) => {
        const columnTasks = getTasksByStatus(statusConfig.value);
        const isDropTarget = dragOverColumn === statusConfig.value;

        return (
          <div
            key={statusConfig.value}
            className={cn(
              'flex-shrink-0 w-[280px] flex flex-col rounded-lg border bg-muted/20',
              isDropTarget && 'ring-2 ring-primary ring-offset-1'
            )}
            onDragOver={(e) => handleDragOver(e, statusConfig.value)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, statusConfig.value as Task['status'])}
          >
            {/* Column Header */}
            <div
              className={cn(
                'px-3 py-2 border-b rounded-t-lg',
                statusConfig.headerColor
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn('w-2.5 h-2.5 rounded-full', statusConfig.color)}
                  />
                  <h3 className="font-semibold text-sm">{statusConfig.label}</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {columnTasks.length}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {columnTasks.length === 0 ? (
                  <div
                    className={cn(
                      'flex items-center justify-center h-20 rounded-lg border-2 border-dashed',
                      'text-xs text-muted-foreground',
                      isDropTarget
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/20'
                    )}
                  >
                    {isDropTarget ? 'Solte aqui' : 'Nenhuma tarefa'}
                  </div>
                ) : (
                  columnTasks.map((task) => (
                    <TarefaCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}

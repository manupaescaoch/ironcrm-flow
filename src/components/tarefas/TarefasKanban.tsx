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
    <div className="flex gap-4 h-[calc(100vh-300px)] overflow-x-auto pb-4">
      {STATUS_CONFIG.map((statusConfig) => {
        const columnTasks = getTasksByStatus(statusConfig.value);
        const isDropTarget = dragOverColumn === statusConfig.value;

        return (
          <div
            key={statusConfig.value}
            className={cn(
              'flex-shrink-0 w-[300px] flex flex-col rounded-lg border bg-muted/30',
              isDropTarget && 'ring-2 ring-primary ring-offset-2'
            )}
            onDragOver={(e) => handleDragOver(e, statusConfig.value)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, statusConfig.value as Task['status'])}
          >
            {/* Column Header */}
            <div
              className={cn(
                'px-4 py-3 border-b rounded-t-lg',
                statusConfig.headerColor
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={cn('w-3 h-3 rounded-full', statusConfig.color)}
                  />
                  <h3 className="font-semibold text-sm">{statusConfig.label}</h3>
                </div>
                <span className="text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
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
                      'flex items-center justify-center h-24 rounded-lg border-2 border-dashed',
                      'text-sm text-muted-foreground',
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

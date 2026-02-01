import { useMemo } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Task, PRIORIDADES } from '@/hooks/useTarefasData';

interface TarefaCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  compact?: boolean;
}

export function TarefaCard({ task, onClick, isDragging, compact = false }: TarefaCardProps) {
  const prioridadeConfig = useMemo(
    () => PRIORIDADES.find((p) => p.value === task.prioridade),
    [task.prioridade]
  );

  const prazoStatus = useMemo(() => {
    if (!task.prazo) return null;
    const prazoDate = new Date(task.prazo);
    if (task.status === 'concluida') return 'completed';
    if (isPast(prazoDate) && !isToday(prazoDate)) return 'overdue';
    if (isToday(prazoDate)) return 'today';
    return 'upcoming';
  }, [task.prazo, task.status]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (compact) {
    return (
      <div
        className={cn(
          'px-2 py-1 rounded text-xs truncate cursor-pointer',
          'hover:bg-muted/50 transition-colors',
          prioridadeConfig?.color
        )}
        onClick={onClick}
        title={task.titulo}
      >
        {task.titulo}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        'border border-border bg-card',
        isDragging && 'opacity-50 rotate-2 scale-105 shadow-lg'
      )}
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <h4 className="font-medium text-sm line-clamp-2">{task.titulo}</h4>

        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0 h-5', prioridadeConfig?.color)}
          >
            {prioridadeConfig?.label}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 bg-muted/50"
          >
            {task.setor}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <User className="w-3 h-3" />
          <span className="truncate">{task.responsavel}</span>
        </div>

        {task.prazo && (
          <div
            className={cn(
              'flex items-center gap-2 text-xs',
              prazoStatus === 'overdue' && 'text-red-500 font-medium',
              prazoStatus === 'today' && 'text-amber-500 font-medium',
              prazoStatus === 'upcoming' && 'text-muted-foreground',
              prazoStatus === 'completed' && 'text-muted-foreground line-through'
            )}
          >
            <Calendar className="w-3 h-3" />
            <span>
              {format(new Date(task.prazo), "dd 'de' MMM", { locale: ptBR })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo, useEffect, useState } from 'react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Building2, Calendar, CheckSquare, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Task, PRIORIDADES } from '@/hooks/useTarefasData';
import { useUnidade } from '@/contexts/UnidadeContext';
import { supabase } from '@/integrations/supabase/client';

interface TarefaCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
  compact?: boolean;
}

interface SubtaskProgress {
  completed: number;
  total: number;
}

export function TarefaCard({ task, onClick, isDragging, compact = false }: TarefaCardProps) {
  const { unidades } = useUnidade();
  const [subtaskProgress, setSubtaskProgress] = useState<SubtaskProgress | null>(null);
  
  const prioridadeConfig = useMemo(
    () => PRIORIDADES.find((p) => p.value === task.prioridade),
    [task.prioridade]
  );

  const unidadeNome = useMemo(() => {
    const unidade = unidades.find((u) => u.id === task.unidade_id);
    return unidade?.nome || '';
  }, [unidades, task.unidade_id]);

  const prazoStatus = useMemo(() => {
    if (!task.prazo) return null;
    const prazoDate = new Date(task.prazo);
    if (task.status === 'concluida') return 'completed';
    if (isPast(prazoDate) && !isToday(prazoDate)) return 'overdue';
    if (isToday(prazoDate)) return 'today';
    return 'upcoming';
  }, [task.prazo, task.status]);

  const isOverdue = prazoStatus === 'overdue';

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

  // Fetch subtask progress
  useEffect(() => {
    const fetchProgress = async () => {
      const { data, error } = await supabase
        .from('task_subtasks')
        .select('concluido')
        .eq('task_id', task.id);

      if (!error && data && data.length > 0) {
        setSubtaskProgress({
          completed: data.filter((s) => s.concluido).length,
          total: data.length,
        });
      } else {
        setSubtaskProgress(null);
      }
    };

    fetchProgress();
  }, [task.id]);

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
        'border bg-card',
        isDragging && 'opacity-50 rotate-2 scale-105 shadow-lg',
        isOverdue && 'border-red-500/50 bg-red-500/5'
      )}
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Overdue badge */}
        {isOverdue && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[10px] font-semibold">ATRASADA</span>
          </div>
        )}

        <h4 className="font-medium text-sm line-clamp-2">{task.titulo}</h4>

        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0 h-5', prioridadeConfig?.color)}
          >
            {prioridadeConfig?.label}
          </Badge>
        </div>

        {/* Responsável with avatar */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-medium',
              getAvatarColor(task.responsavel)
            )}
          >
            {getInitials(task.responsavel)}
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {task.responsavel}
          </span>
        </div>

        {unidadeNome && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{unidadeNome}</span>
          </div>
        )}

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
              {task.hora_prazo && ` às ${task.hora_prazo.slice(0, 5)}`}
            </span>
          </div>
        )}

        {/* Subtask progress */}
        {subtaskProgress && subtaskProgress.total > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckSquare className="w-3 h-3" />
            <div className="flex items-center gap-1.5">
              <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all',
                    subtaskProgress.completed === subtaskProgress.total
                      ? 'bg-green-500'
                      : 'bg-primary'
                  )}
                  style={{
                    width: `${(subtaskProgress.completed / subtaskProgress.total) * 100}%`,
                  }}
                />
              </div>
              <span>
                {subtaskProgress.completed}/{subtaskProgress.total}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

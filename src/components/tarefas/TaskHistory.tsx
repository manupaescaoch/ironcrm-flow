import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskHistory } from '@/hooks/useTaskHistory';
import { cn } from '@/lib/utils';

interface TaskHistoryProps {
  taskId: string;
}

export function TaskHistory({ taskId }: TaskHistoryProps) {
  const { history, loading, formatValue, getCampoLabel } = useTaskHistory(taskId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <History className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Nenhuma alteração registrada</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3">
        {history.map((entry, index) => (
          <div
            key={entry.id}
            className={cn(
              'relative pl-6 pb-3',
              index < history.length - 1 && 'border-l border-border ml-2'
            )}
          >
            {/* Timeline dot */}
            <div className="absolute left-0 top-0 w-4 h-4 -translate-x-1/2 rounded-full bg-primary/20 border-2 border-primary" />

            <div className="bg-muted/50 rounded-lg p-3 ml-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">{entry.user_name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <p className="text-sm">
                Alterou <strong>{getCampoLabel(entry.campo)}</strong>
                {entry.valor_anterior && (
                  <>
                    {' '}de{' '}
                    <span className="text-muted-foreground line-through">
                      {formatValue(entry.campo, entry.valor_anterior)}
                    </span>
                  </>
                )}
                {' '}para{' '}
                <span className="text-primary font-medium">
                  {formatValue(entry.campo, entry.valor_novo)}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

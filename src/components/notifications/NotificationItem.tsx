import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckSquare, RefreshCw, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskNotification } from '@/hooks/useTaskNotifications';

interface NotificationItemProps {
  notification: TaskNotification;
  onClick: (notification: TaskNotification) => void;
}

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  nova_tarefa: CheckSquare,
  tarefa_atualizada: RefreshCw,
  prazo_proximo: Bell,
};

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const Icon = typeIcons[notification.tipo] || Bell;
  
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR
  });

  return (
    <button
      onClick={() => onClick(notification)}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors rounded-lg',
        'hover:bg-accent/50',
        !notification.lida && 'bg-primary/5'
      )}
    >
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        notification.lida 
          ? 'bg-muted text-muted-foreground' 
          : 'bg-primary/10 text-primary'
      )}>
        <Icon className="w-4 h-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn(
            'text-sm truncate',
            !notification.lida && 'font-medium'
          )}>
            {notification.titulo}
          </p>
          {!notification.lida && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        
        {notification.mensagem && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.mensagem}
          </p>
        )}
        
        <p className="text-xs text-muted-foreground/70 mt-1">
          {timeAgo}
        </p>
      </div>
    </button>
  );
}

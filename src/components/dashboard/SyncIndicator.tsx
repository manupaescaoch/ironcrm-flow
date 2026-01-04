import { memo, useEffect, useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncIndicatorProps {
  lastSyncTime?: Date;
  className?: string;
}

export const SyncIndicator = memo(function SyncIndicator({ 
  lastSyncTime, 
  className 
}: SyncIndicatorProps) {
  const [showSyncing, setShowSyncing] = useState(false);
  const [displayTime, setDisplayTime] = useState<string>('');

  useEffect(() => {
    if (lastSyncTime) {
      setShowSyncing(true);
      const timer = setTimeout(() => {
        setShowSyncing(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [lastSyncTime]);

  useEffect(() => {
    const updateDisplayTime = () => {
      if (!lastSyncTime) {
        setDisplayTime('');
        return;
      }
      
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);
      
      if (diff < 5) {
        setDisplayTime('agora');
      } else if (diff < 60) {
        setDisplayTime(`${diff}s atrás`);
      } else if (diff < 3600) {
        setDisplayTime(`${Math.floor(diff / 60)}min atrás`);
      } else {
        setDisplayTime(lastSyncTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      }
    };

    updateDisplayTime();
    const interval = setInterval(updateDisplayTime, 10000);
    return () => clearInterval(interval);
  }, [lastSyncTime]);

  if (!lastSyncTime) return null;

  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground transition-all duration-300",
        showSyncing && "text-primary",
        className
      )}
    >
      {showSyncing ? (
        <>
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Sincronizando...</span>
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-green-500" />
          <span>Sincronizado {displayTime}</span>
        </>
      )}
    </div>
  );
});

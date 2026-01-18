import { CalendarClock, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { VencimentosSummary } from '@/hooks/useVencimentosData';

interface VencimentosKPICardProps {
  summary: VencimentosSummary;
  onClick?: () => void;
  isActive?: boolean;
}

export function VencimentosKPICard({ summary, onClick, isActive }: VencimentosKPICardProps) {
  const hasUrgent = summary.vencidos > 0 || summary.urgentes > 0;
  const hasAttention = summary.atencao > 0;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        isActive && 'ring-2 ring-primary',
        hasUrgent 
          ? 'border-destructive/50 bg-destructive/5' 
          : hasAttention 
          ? 'border-yellow-500/50 bg-yellow-500/5'
          : 'border-border'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className={cn(
              'h-5 w-5',
              hasUrgent ? 'text-destructive' : hasAttention ? 'text-yellow-600' : 'text-muted-foreground'
            )} />
            <span className="text-sm font-medium">Planos Vencendo</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="flex flex-col items-center">
            <AlertTriangle className="h-4 w-4 text-destructive mb-1" />
            <span className={cn(
              'text-lg font-bold',
              summary.vencidos > 0 ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {summary.vencidos}
            </span>
            <span className="text-[10px] text-muted-foreground">Vencidos</span>
          </div>

          <div className="flex flex-col items-center">
            <Clock className="h-4 w-4 text-orange-500 mb-1" />
            <span className={cn(
              'text-lg font-bold',
              summary.urgentes > 0 ? 'text-orange-500' : 'text-muted-foreground'
            )}>
              {summary.urgentes}
            </span>
            <span className="text-[10px] text-muted-foreground">7 dias</span>
          </div>

          <div className="flex flex-col items-center">
            <Clock className="h-4 w-4 text-yellow-500 mb-1" />
            <span className={cn(
              'text-lg font-bold',
              summary.atencao > 0 ? 'text-yellow-600' : 'text-muted-foreground'
            )}>
              {summary.atencao}
            </span>
            <span className="text-[10px] text-muted-foreground">15 dias</span>
          </div>

          <div className="flex flex-col items-center">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mb-1" />
            <span className="text-lg font-bold text-muted-foreground">
              {summary.proximos + summary.ok}
            </span>
            <span className="text-[10px] text-muted-foreground">OK</span>
          </div>
        </div>

        {onClick && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            Clique para ver detalhes
          </p>
        )}
      </CardContent>
    </Card>
  );
}

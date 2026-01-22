import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { VencimentoStatus } from '@/hooks/useVencimentosData';

interface VencimentoBadgeProps {
  status: VencimentoStatus;
  diasRestantes: number;
  className?: string;
}

const statusConfig: Record<VencimentoStatus, { label: string; className: string }> = {
  inadimplente: {
    label: 'Inadimplente',
    className: 'bg-destructive text-destructive-foreground border-destructive',
  },
  vencido: {
    label: 'Vencido',
    className: 'bg-destructive/10 text-destructive border-destructive/30',
  },
  urgente: {
    label: 'Vence em 7 dias',
    className: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  },
  atencao: {
    label: 'Vence em 15 dias',
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  },
  proximo: {
    label: 'Vence em 30 dias',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  ok: {
    label: 'OK',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  },
};

export function VencimentoBadge({ status, diasRestantes, className }: VencimentoBadgeProps) {
  const config = statusConfig[status];
  
  const displayLabel = status === 'inadimplente'
    ? `${Math.abs(diasRestantes)} dias em atraso`
    : status === 'vencido' 
    ? `Vencido há ${Math.abs(diasRestantes)} dias`
    : status === 'ok'
    ? `${diasRestantes} dias`
    : config.label;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {displayLabel}
    </Badge>
  );
}

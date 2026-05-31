import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusEffetivo, STATUS_ENCAMINHAMENTO } from './constants';

interface Props {
  prazo: string | null;
  status: string;
  className?: string;
}

const STYLES: Record<string, string> = {
  aberto: 'bg-muted text-muted-foreground border-border',
  em_andamento: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  concluido: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  atrasado: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function EncaminhamentoStatusBadge({ prazo, status, className }: Props) {
  const eff = statusEffetivo(prazo, status);
  const label = STATUS_ENCAMINHAMENTO.find((s) => s.value === eff)?.label ?? eff;
  return (
    <Badge variant="outline" className={cn('font-medium', STYLES[eff], className)}>
      {label}
    </Badge>
  );
}

export function ReuniaoStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    aberta: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    concluida: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    arquivada: 'bg-muted text-muted-foreground border-border',
  };
  const labels: Record<string, string> = {
    aberta: 'Aberta',
    concluida: 'Concluída',
    arquivada: 'Arquivada',
  };
  return (
    <Badge variant="outline" className={cn('font-medium', map[status])}>
      {labels[status] ?? status}
    </Badge>
  );
}

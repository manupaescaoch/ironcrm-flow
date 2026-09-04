import { cn } from '@/lib/utils';
import type { OpsStatus } from '@/hooks/useOpsExecucao';

const LABELS: Record<OpsStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

const STYLES: Record<OpsStatus, string> = {
  pendente: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  em_andamento: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  concluida: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  atrasada: 'bg-destructive/10 text-destructive',
  cancelada: 'bg-secondary text-secondary-foreground line-through',
};

export function OpsStatusBadge({ status, className }: { status: OpsStatus; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', STYLES[status], className)}>
      {LABELS[status]}
    </span>
  );
}

export function opsStatusLabel(status: OpsStatus) {
  return LABELS[status];
}

/** "atrasada" é derivada: horário/prazo vencido sem conclusão. */
export function deriveOpsStatus(
  status: OpsStatus,
  opts: { data: string; horario?: string | null; prazo?: string | null },
): OpsStatus {
  if (status === 'concluida' || status === 'cancelada') return status;
  const limite = opts.prazo || opts.horario;
  if (!limite) return status;
  const [y, m, d] = opts.data.split('-').map(Number);
  const [hh, mm] = limite.slice(0, 5).split(':').map(Number);
  const alvo = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  return alvo.getTime() < Date.now() ? 'atrasada' : status;
}

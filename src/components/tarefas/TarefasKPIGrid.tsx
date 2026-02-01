import { useMemo } from 'react';
import { ClipboardList, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task } from '@/hooks/useTarefasData';
import { isPast, isToday, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

interface TarefasKPIGridProps {
  tasks: Task[];
}

interface KPIData {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

export function TarefasKPIGrid({ tasks }: TarefasKPIGridProps) {
  const kpis = useMemo<KPIData[]>(() => {
    const activeTasks = tasks.filter((t) => !t.arquivada);
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const total = activeTasks.length;

    const atrasadas = activeTasks.filter((t) => {
      if (!t.prazo || t.status === 'concluida') return false;
      const prazoDate = new Date(t.prazo);
      return isPast(prazoDate) && !isToday(prazoDate);
    }).length;

    const emAndamento = activeTasks.filter(
      (t) => t.status === 'em_andamento'
    ).length;

    const concluidasMes = activeTasks.filter((t) => {
      if (t.status !== 'concluida' || !t.concluida_em) return false;
      const concluidaDate = new Date(t.concluida_em);
      return isWithinInterval(concluidaDate, { start: monthStart, end: monthEnd });
    }).length;

    return [
      {
        label: 'Total',
        value: total,
        icon: ClipboardList,
        color: 'text-blue-600',
        bgColor: 'bg-blue-500/10',
      },
      {
        label: 'Atrasadas',
        value: atrasadas,
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-500/10',
      },
      {
        label: 'Em Andamento',
        value: emAndamento,
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-500/10',
      },
      {
        label: 'Concluídas (Mês)',
        value: concluidasMes,
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-500/10',
      },
    ];
  }, [tasks]);

  return (
    <div className="flex flex-wrap gap-3">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg border bg-card min-w-[140px]',
            kpi.value > 0 && kpi.label === 'Atrasadas' && 'border-red-500/30 bg-red-500/5'
          )}
        >
          <div className={cn('p-1.5 rounded-md', kpi.bgColor)}>
            <kpi.icon className={cn('w-4 h-4', kpi.color)} />
          </div>
          <div>
            <p className={cn('text-lg font-bold leading-none', kpi.color)}>
              {kpi.value}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {kpi.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

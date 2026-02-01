import { useMemo } from 'react';
import { ClipboardList, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  description: string;
}

export function TarefasKPIGrid({ tasks }: TarefasKPIGridProps) {
  const kpis = useMemo<KPIData[]>(() => {
    const activeTasks = tasks.filter((t) => !t.arquivada);
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    // Total de tarefas ativas
    const total = activeTasks.length;

    // Tarefas atrasadas (prazo passou e não está concluída)
    const atrasadas = activeTasks.filter((t) => {
      if (!t.prazo || t.status === 'concluida') return false;
      const prazoDate = new Date(t.prazo);
      return isPast(prazoDate) && !isToday(prazoDate);
    }).length;

    // Em andamento
    const emAndamento = activeTasks.filter(
      (t) => t.status === 'em_andamento'
    ).length;

    // Concluídas este mês
    const concluidasMes = activeTasks.filter((t) => {
      if (t.status !== 'concluida' || !t.concluida_em) return false;
      const concluidaDate = new Date(t.concluida_em);
      return isWithinInterval(concluidaDate, { start: monthStart, end: monthEnd });
    }).length;

    return [
      {
        label: 'Total de Tarefas',
        value: total,
        icon: ClipboardList,
        color: 'text-blue-600',
        bgColor: 'bg-blue-500/10',
        description: 'Tarefas ativas',
      },
      {
        label: 'Atrasadas',
        value: atrasadas,
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-500/10',
        description: 'Prazo vencido',
      },
      {
        label: 'Em Andamento',
        value: emAndamento,
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-500/10',
        description: 'Sendo executadas',
      },
      {
        label: 'Concluídas (Mês)',
        value: concluidasMes,
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-500/10',
        description: 'Finalizadas este mês',
      },
    ];
  }, [tasks]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="border bg-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  {kpi.label}
                </p>
                <p className={cn('text-2xl font-bold', kpi.color)}>
                  {kpi.value}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {kpi.description}
                </p>
              </div>
              <div className={cn('p-2 rounded-lg', kpi.bgColor)}>
                <kpi.icon className={cn('w-5 h-5', kpi.color)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

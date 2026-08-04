import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CalendarClock, AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import { formatCurrency } from './constants';

interface KpiItem {
  valor: number;
  qtd: number;
}

interface Props {
  totalMes: KpiItem;
  vencendoHoje: KpiItem;
  pagoPeriodo: KpiItem;
  atrasadas: KpiItem;
  onSelectStatus?: (status: 'todos' | 'vencendo_hoje' | 'paga' | 'atrasada') => void;
}

export function ContasPagarKPIs({ totalMes, vencendoHoje, pagoPeriodo, atrasadas, onSelectStatus }: Props) {
  const cards = [
    {
      key: 'todos' as const,
      label: 'Total do Mês',
      item: totalMes,
      icon: Wallet,
      accent: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      key: 'vencendo_hoje' as const,
      label: 'Vencendo Hoje',
      item: vencendoHoje,
      icon: CalendarClock,
      accent: 'text-amber-600',
      bg: 'bg-amber-100',
    },
    {
      key: 'paga' as const,
      label: 'Pago no Período',
      item: pagoPeriodo,
      icon: CheckCircle2,
      accent: 'text-emerald-600',
      bg: 'bg-emerald-100',
    },
    {
      key: 'atrasada' as const,
      label: 'Atrasadas',
      item: atrasadas,
      icon: AlertTriangle,
      accent: 'text-red-600',
      bg: 'bg-red-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card
          key={card.key}
          onClick={() => onSelectStatus?.(card.key)}
          className={cn(
            'p-4 rounded-xl shadow-sm border transition-colors',
            onSelectStatus && 'cursor-pointer hover:border-primary/40',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{card.label}</p>
              <p className="text-xl font-bold mt-1 truncate">{formatCurrency(card.item.valor)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {card.item.qtd} {card.item.qtd === 1 ? 'conta' : 'contas'}
              </p>
            </div>
            <div className={cn('p-2 rounded-lg shrink-0', card.bg)}>
              <card.icon className={cn('w-4 h-4', card.accent)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

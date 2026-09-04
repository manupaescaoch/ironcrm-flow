import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AtividadesUnidadeResumoProps {
  previstas: number;
  concluidas: number;
  emAndamento: number;
  atrasadas: number;
  percentual: number;
  className?: string;
}

const ITEMS = [
  { key: 'previstas', label: 'Previstas', color: 'text-blue-600' },
  { key: 'concluidas', label: 'Concluídas', color: 'text-emerald-600' },
  { key: 'emAndamento', label: 'Em andamento', color: 'text-amber-600' },
  { key: 'atrasadas', label: 'Atrasadas', color: 'text-destructive' },
] as const;

export const AtividadesUnidadeResumo = memo(function AtividadesUnidadeResumo({
  previstas,
  concluidas,
  emAndamento,
  atrasadas,
  percentual,
  className,
}: AtividadesUnidadeResumoProps) {
  const values = { previstas, concluidas, emAndamento, atrasadas };

  return (
    <Card className={cn('border-border/60', className)}>
      <CardContent className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold">Atividades da Unidade</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{percentual}% concluído</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ITEMS.map((item) => (
            <div key={item.key}>
              <p className={cn('text-2xl font-semibold leading-none tabular-nums', item.color)}>
                {values[item.key]}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${Math.min(100, percentual)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
});

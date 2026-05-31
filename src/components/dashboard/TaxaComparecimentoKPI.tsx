import { memo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TaxaComparecimentoKPIProps {
  comparecimentos: number;
  agendados: number;
}

export const TaxaComparecimentoKPI = memo(function TaxaComparecimentoKPI({
  comparecimentos,
  agendados,
}: TaxaComparecimentoKPIProps) {
  const taxa = agendados > 0 ? Math.round((comparecimentos / agendados) * 100) : 0;

  // Donut SVG
  const size = 44;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (taxa / 100) * circumference;

  return (
    <Card className="border shadow-sm rounded-2xl">
      <CardContent className="p-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-teal-100 dark:bg-teal-950/40">
            <PieIcon className="w-3.5 h-3.5 text-teal-500" />
          </div>
          <p
            lang="pt-BR"
            className="text-[11px] font-medium text-muted-foreground leading-tight min-w-0 flex-1 hyphens-auto [word-break:normal] [overflow-wrap:break-word]"
          >
            Taxa de Comparecimento
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={cn('text-xl font-bold leading-none mb-0.5', 'text-teal-600')}>
              {taxa}%
            </p>
            <p className="text-[10px] text-muted-foreground leading-snug">
              {comparecimentos} de {agendados}
            </p>
          </div>
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="flex-shrink-0 -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              className="stroke-teal-100 dark:stroke-teal-950/60"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              className="stroke-teal-500 transition-[stroke-dasharray] duration-500"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
});

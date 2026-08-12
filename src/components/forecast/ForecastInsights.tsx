import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Insight } from '@/lib/forecast';

const TOM: Record<Insight['tom'], string> = {
  bom: 'border-l-emerald-500',
  atencao: 'border-l-amber-500',
  ruim: 'border-l-red-500',
  neutro: 'border-l-primary',
};

export function ForecastInsights({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;
  return (
    <Card className="border-border/70">
      <CardContent className="p-4 space-y-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Leitura do Forecast
        </h2>
        {insights.map((i, idx) => (
          <div key={idx} className={cn('border-l-2 pl-3 py-0.5', TOM[i.tom])}>
            <Badge variant="outline" className="text-[9px] uppercase tracking-wider mb-1">
              {i.tipo}
            </Badge>
            <p className="text-xs leading-relaxed text-foreground/90">{i.texto}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

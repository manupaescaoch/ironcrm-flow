import { Lightbulb, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Insight {
  texto: string;
  tipo: 'positivo' | 'atencao' | 'neutro';
}

const icon = { positivo: TrendingUp, atencao: TrendingDown, neutro: Minus };
const color = {
  positivo: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950',
  atencao: 'text-amber-600 bg-amber-100 dark:bg-amber-950',
  neutro: 'text-muted-foreground bg-muted',
};

export function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Insights do período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Sem dados suficientes para gerar insights no período selecionado.</p>
        ) : (
          insights.map((i, idx) => {
            const Icon = icon[i.tipo];
            return (
              <div key={idx} className="flex items-start gap-2 rounded-md border p-2">
                <span className={`mt-0.5 rounded-md p-1 ${color[i.tipo]}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <p className="text-xs leading-relaxed">{i.texto}</p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

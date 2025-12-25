import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ConversionScoreResult } from '@/hooks/useConversionScore';

interface ConversionScoreCardProps {
  scoreData: ConversionScoreResult;
}

export const ConversionScoreCard = ({ scoreData }: ConversionScoreCardProps) => {
  const { score, label, color, bgColor, fatoresPositivos, podeMelhorar } = scoreData;

  const getProgressColor = () => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getLabelIcon = () => {
    if (score >= 80) return '🔥';
    if (score >= 60) return '☀️';
    if (score >= 40) return '❄️';
    return '🧊';
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: `hsl(var(--${score >= 60 ? 'primary' : 'muted'}))` }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Previsão de Fechamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Principal */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-2xl font-bold">{score}%</span>
              <Badge variant="outline" className={`${color} border-current`}>
                {getLabelIcon()} {label}
              </Badge>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${getProgressColor()} transition-all duration-500`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Fatores Positivos */}
        {fatoresPositivos.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400">
              <TrendingUp className="h-3.5 w-3.5" />
              Fatores Positivos
            </div>
            <ul className="space-y-0.5">
              {fatoresPositivos.map((fator, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                  {fator}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pode Melhorar */}
        {podeMelhorar.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              Pode Melhorar
            </div>
            <ul className="space-y-0.5">
              {podeMelhorar.map((item, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="w-3 h-3 flex items-center justify-center text-amber-500 flex-shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

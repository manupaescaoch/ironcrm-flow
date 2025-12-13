import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variacao?: { diff: number; percentual: number } | null;
  color?: 'default' | 'green' | 'red' | 'amber';
  invertVariacao?: boolean;
  subtitle?: string;
}

export function KPICard({ 
  title, 
  value, 
  icon: Icon, 
  variacao, 
  color = 'default',
  invertVariacao = false,
  subtitle
}: KPICardProps) {
  const isPositive = variacao ? (invertVariacao ? variacao.diff < 0 : variacao.diff > 0) : null;
  const isNegative = variacao ? (invertVariacao ? variacao.diff > 0 : variacao.diff < 0) : null;
  
  const colorClasses = {
    default: 'text-foreground',
    green: 'text-emerald-600',
    red: 'text-rose-600',
    amber: 'text-amber-600'
  };

  const iconBgClasses = {
    default: 'bg-muted',
    green: 'bg-emerald-100 dark:bg-emerald-950',
    red: 'bg-rose-100 dark:bg-rose-950',
    amber: 'bg-amber-100 dark:bg-amber-950'
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold mt-1', colorClasses[color])}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
            {variacao && (
              <div className={cn(
                'flex items-center gap-1 mt-2 text-sm',
                isPositive && 'text-emerald-600',
                isNegative && 'text-rose-600',
                !isPositive && !isNegative && 'text-muted-foreground'
              )}>
                {isPositive && <TrendingUp className="w-4 h-4" />}
                {isNegative && <TrendingDown className="w-4 h-4" />}
                {!isPositive && !isNegative && <Minus className="w-4 h-4" />}
                <span>
                  {variacao.diff > 0 ? '+' : ''}{variacao.diff} ({variacao.percentual > 0 ? '+' : ''}{variacao.percentual}%)
                </span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', iconBgClasses[color])}>
            <Icon className={cn('w-5 h-5', colorClasses[color])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

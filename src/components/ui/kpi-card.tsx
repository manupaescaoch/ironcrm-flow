import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KPIVariacao {
  diff: number;
  percentual: number;
}

export interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  valueColor?: string;
  subtitle?: string;
  onClick?: () => void;
  isActive?: boolean;
  activeColor?: string;
  variant?: 'default' | 'compact' | 'highlight' | 'detailed';
  showClickHint?: boolean;
  className?: string;
  variacao?: KPIVariacao | null;
  invertVariacao?: boolean;
  color?: 'default' | 'green' | 'red' | 'amber';
}

const colorMap = {
  default: { text: 'text-foreground', icon: 'text-muted-foreground', bg: 'bg-muted' },
  green: { text: 'text-emerald-600', icon: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-950' },
  red: { text: 'text-rose-600', icon: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-950' },
  amber: { text: 'text-amber-600', icon: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-950' },
};

export const KPICard = memo(function KPICard({
  title,
  value,
  icon: Icon,
  iconColor,
  valueColor,
  subtitle,
  onClick,
  isActive = false,
  activeColor = 'primary',
  variant = 'default',
  showClickHint = false,
  className,
  variacao,
  invertVariacao = false,
  color = 'default',
}: KPICardProps) {
  const isClickable = !!onClick;

  const activeRingClass = {
    primary: 'ring-2 ring-primary border-primary',
    purple: 'ring-2 ring-purple-500 border-purple-500',
    amber: 'ring-2 ring-amber-500 border-amber-500',
    green: 'ring-2 ring-green-500 border-green-500',
    blue: 'ring-2 ring-blue-500 border-blue-500',
  }[activeColor] || 'ring-2 ring-primary border-primary';

  const hoverClass = {
    primary: 'hover:border-primary/50',
    purple: 'hover:border-purple-300',
    amber: 'hover:border-amber-300',
    green: 'hover:border-green-300',
    blue: 'hover:border-blue-300',
  }[activeColor] || 'hover:border-primary/50';

  // Resolve colors - iconColor/valueColor props override color preset
  const colorPreset = colorMap[color];
  const resolvedIconColor = iconColor || colorPreset.icon;
  const resolvedValueColor = valueColor || colorPreset.text;
  const resolvedIconBg = colorPreset.bg;

  // Variacao logic
  const isPositive = variacao ? (invertVariacao ? variacao.diff < 0 : variacao.diff > 0) : null;
  const isNegative = variacao ? (invertVariacao ? variacao.diff > 0 : variacao.diff < 0) : null;

  const VariacaoDisplay = variacao ? (
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
  ) : null;

  // Detailed variant (for relatorio gerencial)
  if (variant === 'detailed') {
    return (
      <Card className={cn(isClickable && 'cursor-pointer', className)} onClick={onClick}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className={cn('text-2xl font-bold mt-1', resolvedValueColor)}>
                {value}
              </p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
              {VariacaoDisplay}
            </div>
            <div className={cn('p-3 rounded-lg', resolvedIconBg)}>
              <Icon className={cn('w-5 h-5', resolvedIconColor)} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <Card 
        className={cn(
          'bg-card border shadow-sm',
          isClickable && `cursor-pointer transition-all hover:shadow-md ${hoverClass}`,
          isActive && activeRingClass,
          className
        )}
        onClick={onClick}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center',
              resolvedIconColor.includes('blue') && 'bg-blue-500/20',
              resolvedIconColor.includes('purple') && 'bg-purple-500/20',
              resolvedIconColor.includes('green') && 'bg-green-500/20',
              resolvedIconColor.includes('amber') && 'bg-amber-500/20',
              resolvedIconColor.includes('cyan') && 'bg-cyan-500/20',
              resolvedIconColor.includes('primary') && 'bg-primary/20',
              resolvedIconColor.includes('emerald') && 'bg-emerald-500/20',
              resolvedIconColor.includes('rose') && 'bg-rose-500/20',
              !resolvedIconColor.includes('blue') && !resolvedIconColor.includes('purple') && 
              !resolvedIconColor.includes('green') && !resolvedIconColor.includes('amber') && 
              !resolvedIconColor.includes('cyan') && !resolvedIconColor.includes('primary') &&
              !resolvedIconColor.includes('emerald') && !resolvedIconColor.includes('rose') && 'bg-muted'
            )}>
              <Icon className={cn('w-6 h-6', resolvedIconColor)} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className={cn('text-2xl font-bold', resolvedValueColor)}>{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'highlight') {
    return (
      <Card 
        className={cn(
          'bg-primary/10 border-primary/30 shadow-sm',
          isClickable && 'cursor-pointer transition-all hover:shadow-md hover:bg-primary/15',
          isActive && activeRingClass,
          className
        )}
        onClick={onClick}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/30 rounded-lg flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold text-primary">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card 
      className={cn(
        isClickable && `cursor-pointer transition-all hover:shadow-md ${hoverClass}`,
        isActive && activeRingClass,
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn('w-5 h-5', resolvedIconColor)} />
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-bold', resolvedValueColor)}>{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {showClickHint && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            Clique para ver detalhes <ChevronDown className="w-3 h-3" />
          </p>
        )}
        {VariacaoDisplay}
      </CardContent>
    </Card>
  );
});

import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  variant?: 'default' | 'compact' | 'highlight';
  showClickHint?: boolean;
  className?: string;
}

export const KPICard = memo(function KPICard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-muted-foreground',
  valueColor = 'text-foreground',
  subtitle,
  onClick,
  isActive = false,
  activeColor = 'primary',
  variant = 'default',
  showClickHint = false,
  className,
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
              iconColor.includes('blue') && 'bg-blue-500/20',
              iconColor.includes('purple') && 'bg-purple-500/20',
              iconColor.includes('green') && 'bg-green-500/20',
              iconColor.includes('amber') && 'bg-amber-500/20',
              iconColor.includes('cyan') && 'bg-cyan-500/20',
              iconColor.includes('primary') && 'bg-primary/20',
              !iconColor.includes('blue') && !iconColor.includes('purple') && 
              !iconColor.includes('green') && !iconColor.includes('amber') && 
              !iconColor.includes('cyan') && !iconColor.includes('primary') && 'bg-muted'
            )}>
              <Icon className={cn('w-6 h-6', iconColor)} />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className={cn('text-2xl font-bold', valueColor)}>{value}</p>
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
        <Icon className={cn('w-5 h-5', iconColor)} />
      </CardHeader>
      <CardContent>
        <p className={cn('text-3xl font-bold', valueColor)}>{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {showClickHint && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            Clique para ver detalhes <ChevronDown className="w-3 h-3" />
          </p>
        )}
      </CardContent>
    </Card>
  );
});

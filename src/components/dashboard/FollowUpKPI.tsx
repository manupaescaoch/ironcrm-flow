import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface FollowUpKPIProps {
  pendingCount: number;
  d1Count?: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function FollowUpKPI({ pendingCount, d1Count = 0, onClick, isActive }: FollowUpKPIProps) {
  const getColorClass = () => {
    if (pendingCount === 0) return 'text-green-600';
    if (pendingCount <= 3) return 'text-orange-500';
    return 'text-red-600';
  };

  const getBorderClass = () => {
    if (d1Count > 0) return 'hover:border-emerald-400 border-emerald-300';
    if (pendingCount === 0) return 'hover:border-green-300';
    if (pendingCount <= 3) return 'hover:border-orange-300';
    return 'hover:border-red-300';
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
        getBorderClass(),
        d1Count > 0 && "bg-gradient-to-br from-emerald-50/50 to-background",
        isActive && pendingCount >= 4 && !d1Count && "ring-2 ring-red-500 border-red-500",
        isActive && pendingCount > 0 && pendingCount < 4 && !d1Count && "ring-2 ring-orange-500 border-orange-500",
        isActive && pendingCount === 0 && "ring-2 ring-green-500 border-green-500",
        isActive && d1Count > 0 && "ring-2 ring-emerald-500 border-emerald-500"
      )}
      onClick={onClick}
    >
      {/* D+1 Priority Badge */}
      {d1Count > 0 && (
        <div className="absolute top-2 right-2">
          <Badge 
            variant="outline" 
            className="bg-emerald-500 text-white border-emerald-600 text-xs px-1.5 py-0.5 animate-pulse flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            {d1Count} D+1
          </Badge>
        </div>
      )}
      
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Follow Ups Pendentes
        </CardTitle>
        <MessageCircle className={cn("w-5 h-5", d1Count > 0 ? "text-emerald-500" : getColorClass())} />
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold", d1Count > 0 ? "text-emerald-600" : getColorClass())}>
          {pendingCount}
        </p>
        {d1Count > 0 && (
          <p className="text-xs text-emerald-600 mt-1 font-medium">
            ⚡ Prioridade máxima
          </p>
        )}
      </CardContent>
    </Card>
  );
}

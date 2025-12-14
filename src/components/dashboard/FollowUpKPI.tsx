import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FollowUpKPIProps {
  pendingCount: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function FollowUpKPI({ pendingCount, onClick, isActive }: FollowUpKPIProps) {
  const getColorClass = () => {
    if (pendingCount === 0) return 'text-green-600';
    if (pendingCount <= 3) return 'text-orange-500';
    return 'text-red-600';
  };

  const getBorderClass = () => {
    if (pendingCount === 0) return 'hover:border-green-300';
    if (pendingCount <= 3) return 'hover:border-orange-300';
    return 'hover:border-red-300';
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        getBorderClass(),
        isActive && pendingCount >= 4 && "ring-2 ring-red-500 border-red-500",
        isActive && pendingCount > 0 && pendingCount < 4 && "ring-2 ring-orange-500 border-orange-500",
        isActive && pendingCount === 0 && "ring-2 ring-green-500 border-green-500"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Follow Ups Pendentes
        </CardTitle>
        <MessageCircle className={cn("w-5 h-5", getColorClass())} />
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold", getColorClass())}>
          {pendingCount}
        </p>
      </CardContent>
    </Card>
  );
}

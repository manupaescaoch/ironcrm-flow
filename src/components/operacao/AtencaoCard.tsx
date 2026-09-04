import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AtencaoItem {
  id: string;
  label: string;
  count: number;
  tone?: 'warning' | 'critical';
  onClick?: () => void;
}

interface AtencaoCardProps {
  items: AtencaoItem[];
}

export const AtencaoCard = memo(function AtencaoCard({ items }: AtencaoCardProps) {
  const visiveis = items.filter((i) => i.count > 0);
  if (visiveis.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-sm font-semibold">Atenção</h3>
        </div>

        <ul className="divide-y divide-border/60 -mx-1">
          {visiveis.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={item.onClick}
                disabled={!item.onClick}
                className={cn(
                  'w-full flex items-center gap-3 px-1 py-2.5 text-left rounded-md transition-colors',
                  item.onClick && 'hover:bg-muted/50',
                )}
              >
                <span
                  className={cn(
                    'text-base font-semibold tabular-nums w-8 shrink-0',
                    item.tone === 'critical' ? 'text-destructive' : 'text-amber-600',
                  )}
                >
                  {item.count}
                </span>
                <span className="flex-1 text-xs text-foreground/90 leading-snug">{item.label}</span>
                {item.onClick && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
});

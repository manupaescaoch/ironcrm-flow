import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, User } from 'lucide-react';
import { OpsStatusBadge } from '@/components/ops/OpsStatusBadge';
import type { OpsGestaoTarefa } from '@/hooks/useOpsGestao';
import { cn } from '@/lib/utils';

interface TarefasDeHojeListProps {
  tarefas: OpsGestaoTarefa[];
  loading?: boolean;
}

export const TarefasDeHojeList = memo(function TarefasDeHojeList({ tarefas, loading }: TarefasDeHojeListProps) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold">Tarefas de hoje</h3>
          <span className="text-xs text-muted-foreground tabular-nums">{tarefas.length}</span>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando tarefas…</p>
        ) : tarefas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma tarefa prevista para hoje nesta unidade.</p>
        ) : (
          <ul className="divide-y divide-border/60 max-h-[420px] overflow-y-auto scrollbar-visible -mx-1">
            {tarefas.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">{t.titulo}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {t.horario && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t.horario.slice(0, 5)}
                      </span>
                    )}
                    {t.responsavel_nome && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <User className="h-3 w-3" />
                        {t.responsavel_nome}
                      </span>
                    )}
                    {t.setor && <span className="truncate">{t.setor}</span>}
                    {t.prioridade === 'critica' && (
                      <span className={cn('font-semibold text-destructive')}>Crítica</span>
                    )}
                  </div>
                </div>
                <OpsStatusBadge status={t.status} className="shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});

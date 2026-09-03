import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Bell, BellOff, Check, CheckSquare, Clock, Loader2, RefreshCw } from 'lucide-react';
import { OpsLayout } from '@/components/ops/OpsLayout';
import { OpsTarefaRow, OpsTarefaSheet } from '@/components/ops/OpsTarefaItem';
import { useOpsNotificacoes } from '@/hooks/useOpsNotificacoes';
import { useOpsMeuDia, type OpsTarefaDoDia } from '@/hooks/useOpsMeuDia';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TIPO_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  nova_atividade: CheckSquare,
  atividade_atualizada: RefreshCw,
  lembrete: Clock,
  atraso: AlertTriangle,
  escalonamento: AlertTriangle,
};

export default function OpsAlertas() {
  const hoje = useMemo(() => new Date(), []);
  const { notificacoes, naoLidas, loading, marcarLida, marcarTodasLidas } = useOpsNotificacoes();
  const { tarefas, isLoading } = useOpsMeuDia('unidade', hoje);
  const [selecionada, setSelecionada] = useState<OpsTarefaDoDia | null>(null);

  const atencao = useMemo(
    () => tarefas.filter((t) => t.status === 'atrasada' || (t.prioridade === 'critica' && t.status !== 'concluida')),
    [tarefas],
  );

  return (
    <OpsLayout title="Alertas">
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Alertas</h2>
            <p className="text-xs text-muted-foreground">
              {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Tudo em dia'}
            </p>
          </div>
          {naoLidas > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={() => marcarTodasLidas()}>
              <Check className="h-3.5 w-3.5" /> Marcar todas
            </Button>
          )}
        </div>

        {/* Atenção: atrasadas e críticas de hoje */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Atenção hoje
          </h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : atencao.length === 0 ? (
            <p className="rounded-2xl bg-card p-4 text-xs text-muted-foreground shadow-sm">
              Nenhuma atividade atrasada ou crítica na unidade hoje.
            </p>
          ) : (
            <div className="space-y-2">
              {atencao.map((t) => (
                <OpsTarefaRow key={t.id} tarefa={t} onClick={() => setSelecionada(t)} />
              ))}
            </div>
          )}
        </section>

        {/* Notificações */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> Notificações
          </h3>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notificacoes.length === 0 ? (
            <div className="rounded-2xl bg-card p-8 text-center shadow-sm">
              <BellOff className="mx-auto h-7 w-7 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">Nenhuma notificação</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Você será avisado aqui sobre novas atividades, lembretes e atrasos.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notificacoes.map((n) => {
                const Icon = TIPO_ICON[n.tipo] || Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      if (!n.lida) marcarLida(n.id);
                      const alvo = tarefas.find((t) => t.id === n.atividade_id);
                      if (alvo) setSelecionada(alvo);
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl p-4 text-left shadow-sm transition-colors',
                      n.lida ? 'bg-card' : 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                        n.lida ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', !n.lida && 'font-medium')}>{n.titulo}</p>
                      {n.mensagem && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.mensagem}</p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!n.lida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <OpsTarefaSheet tarefa={selecionada} data={hoje} onClose={() => setSelecionada(null)} />
    </OpsLayout>
  );
}

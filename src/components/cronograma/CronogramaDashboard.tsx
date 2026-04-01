import { Send, MessageSquare, Clock, TrendingUp, Users, AlertCircle, ClipboardList, ClipboardCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCronogramaEnvios } from '@/hooks/useCronogramaEnvios';
import { useCronogramaFuncionarios } from '@/hooks/useCronogramaFuncionarios';
import { useRotinasData } from '@/hooks/useRotinasData';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

export function CronogramaDashboard() {
  const { envios, isLoading: enviosLoading, totalEnviados, totalRespondidos, totalPendentes, taxaResposta } = useCronogramaEnvios();
  const { ativos, isLoading: funcLoading } = useCronogramaFuncionarios();
  const { rotinas, atividades: rotinaAtividades, execucoes, loading: rotinasLoading } = useRotinasData();

  const isLoading = enviosLoading || funcLoading || rotinasLoading;

  // Rotinas KPIs
  const ativas = rotinas.filter(r => r.ativo && !r.arquivada);
  const activeRotinaIds = new Set(ativas.map(r => r.id));
  const todayAtividades = rotinaAtividades.filter(a => activeRotinaIds.has(a.rotina_id));
  const totalPendentesRotina = todayAtividades.length;
  const concluidasHoje = execucoes.filter(e => e.concluida).length;
  const pendentesHoje = Math.max(0, totalPendentesRotina - concluidasHoje);
  const taxaExecucao = totalPendentesRotina > 0 ? Math.round((concluidasHoje / totalPendentesRotina) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const recentEnvios = envios.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Cronograma KPIs */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Cronograma</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Enviados" value={totalEnviados} icon={Send} iconColor="text-blue-500" variant="compact" />
          <KPICard title="Respondidos" value={totalRespondidos} icon={MessageSquare} iconColor="text-emerald-500" variant="compact" />
          <KPICard title="Pendentes" value={totalPendentes} icon={AlertCircle} iconColor="text-amber-500" variant="compact" />
          <KPICard title="Taxa de Resposta" value={`${taxaResposta}%`} icon={TrendingUp} iconColor="text-primary" variant="compact" />
        </div>
      </div>

      {/* Rotinas KPIs */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Rotinas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard title="Total Rotinas" value={rotinas.length} icon={ClipboardList} variant="compact" />
          <KPICard title="Ativas" value={ativas.length} icon={ClipboardCheck} iconColor="text-emerald-500" variant="compact" />
          <KPICard title="Pendentes Hoje" value={pendentesHoje} icon={AlertTriangle} iconColor="text-amber-500" variant="compact" />
          <KPICard title="Concluídas Hoje" value={concluidasHoje} icon={CheckCircle2} iconColor="text-emerald-500" variant="compact" />
        </div>
      </div>

      {/* Funcionários ativos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Funcionários Ativos ({ativos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ativos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado. Vá na aba "Equipe" para cadastrar.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ativos.map(f => (
                <div key={f.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {f.nome.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">{f.setor} · {f.turno}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimos envios */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Últimos Envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentEnvios.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {recentEnvios.map(e => (
                <div key={e.id} className="flex items-center justify-between p-2 rounded-md border">
                  <div>
                    <p className="text-sm font-medium">{e.cronograma_funcionarios?.nome || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{e.formularios?.titulo || e.cronograma_atividades?.titulo || 'Atividade'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.status === 'respondido' ? 'default' : e.status === 'enviado' ? 'secondary' : 'outline'}>
                      {e.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

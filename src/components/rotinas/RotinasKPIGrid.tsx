import { ClipboardList, ClipboardCheck, Clock, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { Rotina, RotinaAtividade, RotinaExecucao } from '@/hooks/useRotinasData';

interface Props {
  rotinas: Rotina[];
  atividades: RotinaAtividade[];
  execucoes: RotinaExecucao[];
}

export function RotinasKPIGrid({ rotinas, atividades, execucoes }: Props) {
  const ativas = rotinas.filter(r => r.ativo && !r.arquivada);
  
  // Count total activities for active rotinas today
  const activeRotinaIds = new Set(ativas.map(r => r.id));
  const todayAtividades = atividades.filter(a => activeRotinaIds.has(a.rotina_id));
  const totalPendentes = todayAtividades.length;
  
  const concluidasHoje = execucoes.filter(e => e.concluida).length;
  const pendentesHoje = Math.max(0, totalPendentes - concluidasHoje);
  
  // Atrasadas: rotinas com horário esperado antes de agora e não concluídas
  const now = new Date();
  const horaAtual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const atrasadas = ativas.filter(r => {
    if (!r.horario_esperado || r.horario_esperado > horaAtual) return false;
    const rotinaAtividades = atividades.filter(a => a.rotina_id === r.id);
    if (rotinaAtividades.length === 0) {
      return !execucoes.some(e => e.rotina_id === r.id && e.concluida && !e.atividade_id);
    }
    return rotinaAtividades.some(a => !execucoes.some(e => e.atividade_id === a.id && e.concluida));
  });

  const taxaExecucao = totalPendentes > 0 ? Math.round((concluidasHoje / totalPendentes) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard title="Total Rotinas" value={rotinas.length} icon={ClipboardList} />
      <KPICard title="Ativas" value={ativas.length} icon={ClipboardCheck} />
      <KPICard title="Pendentes Hoje" value={pendentesHoje} icon={Clock} />
      <KPICard title="Concluídas Hoje" value={concluidasHoje} icon={CheckCircle2} />
      <KPICard title="Atrasadas" value={atrasadas.length} icon={AlertTriangle} />
      <KPICard title="Taxa Execução" value={`${taxaExecucao}%`} icon={TrendingUp} />
    </div>
  );
}

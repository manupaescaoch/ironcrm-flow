import React, { memo } from 'react';
import { Users, CalendarCheck, Calendar, Award, UserCheck, CheckCircle2, Zap, UserX, PieChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/ui/kpi-card';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { TaxaComparecimentoKPI } from '@/components/dashboard/TaxaComparecimentoKPI';
import { Stats, PeriodStats } from '@/components/dashboard/constants';
import { useVencimentosData, VencimentosSummary } from '@/hooks/useVencimentosData';

interface DashboardKPIGridProps {
  stats: Stats;
  periodStats: PeriodStats;
  experimentaisSemanaCount: number;
  followUpPendingCount: number;
  followUpD1Count: number;
  showExperimentaisSection: boolean;
  showMatriculasSection: boolean;
  showFollowUpSection: boolean;
  onExperimentaisClick: () => void;
  onMatriculasClick: () => void;
  onFollowUpClick: () => void;
}

const AlunosAtivosKPI = memo(function AlunosAtivosKPI({ summary }: { summary: VencimentosSummary }) {
  const navigate = useNavigate();
  
  // Alunos ativos = total - vencidos (todos que ainda têm plano válido ou próximo de vencer)
  const alunosAtivos = summary.total - summary.vencidos;
  const emDia = summary.ok;
  const precisamAtencao = summary.urgentes + summary.atencao + summary.proximos;
  
  const handleClick = () => navigate('/vencimentos');

  return (
    <KPICard
      variant="dashboard"
      title="Alunos Ativos"
      value={alunosAtivos}
      icon={UserCheck}
      iconColor="text-green-500"
      valueColor="text-green-600"
      subtitle={`${emDia} em dia, ${precisamAtencao} em atenção`}
      onClick={handleClick}
    />
  );
});

const VencimentosKPI = memo(function VencimentosKPI({ summary }: { summary: VencimentosSummary }) {
  const navigate = useNavigate();
  const urgentCount = summary.vencidos + summary.urgentes;
  const attentionCount = summary.atencao;
  
  const handleClick = () => {
    navigate('/vencimentos');
  };

  // Determine color based on urgency
  const getColor = () => {
    if (summary.vencidos > 0) return 'red';
    if (summary.urgentes > 0) return 'orange';
    if (summary.atencao > 0) return 'yellow';
    return 'green';
  };

  const color = getColor();
  const colorClasses = {
    red: { icon: 'text-red-500', value: 'text-red-600' },
    orange: { icon: 'text-orange-500', value: 'text-orange-600' },
    yellow: { icon: 'text-yellow-500', value: 'text-yellow-600' },
    green: { icon: 'text-green-500', value: 'text-green-600' },
  };

  const subtitle = urgentCount > 0 
    ? `${summary.vencidos} vencidos, ${summary.urgentes} em 7 dias`
    : attentionCount > 0 
    ? `${attentionCount} em 15 dias`
    : 'Todos em dia';

  return (
    <KPICard
      variant="dashboard"
      title="Planos Vencendo"
      value={urgentCount + attentionCount}
      icon={AlertTriangle}
      iconColor={colorClasses[color].icon}
      valueColor={colorClasses[color].value}
      subtitle={subtitle}
      onClick={handleClick}
    />
  );
});

export const DashboardKPIGrid = memo(function DashboardKPIGrid({
  stats,
  periodStats,
  experimentaisSemanaCount,
  followUpPendingCount,
  followUpD1Count,
  showExperimentaisSection,
  showMatriculasSection,
  showFollowUpSection,
  onExperimentaisClick,
  onMatriculasClick,
  onFollowUpClick,
}: DashboardKPIGridProps) {
  const { summary } = useVencimentosData();

  const taxaConversaoMesmoDia = periodStats.comparecimentosPeriodo > 0
    ? Math.round((periodStats.conversaoMesmoDia / periodStats.comparecimentosPeriodo) * 100)
    : 0;

  const naoCompareceram = Math.max(
    0,
    periodStats.experimentaisPeriodo - periodStats.comparecimentosPeriodo
  );
  const taxaComparecimento = periodStats.experimentaisPeriodo > 0
    ? Math.round((periodStats.comparecimentosPeriodo / periodStats.experimentaisPeriodo) * 100)
    : 0;

  return (
    <div className="space-y-4 mb-8">
      {/* Linha 1 — Funil principal (6 KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          variant="dashboard"
          title="Total de Leads"
          value={stats.total}
          icon={Users}
          iconColor="text-blue-500"
          valueColor="text-foreground"
          subtitle="Todos os tempos"
        />

        <KPICard
          variant="dashboard"
          title="Aulas Agendadas"
          value={periodStats.experimentaisPeriodo}
          icon={CalendarCheck}
          iconColor="text-sky-500"
          valueColor="text-sky-600"
          subtitle="No período"
        />

        <KPICard
          variant="dashboard"
          title="Experimentais da Semana"
          value={experimentaisSemanaCount}
          icon={Calendar}
          iconColor="text-purple-500"
          valueColor="text-purple-600"
          subtitle="Esta semana"
          onClick={onExperimentaisClick}
          isActive={showExperimentaisSection}
          activeColor="purple"
        />

        <KPICard
          variant="dashboard"
          title={"Compareci\u00ADmentos"}
          value={periodStats.comparecimentosPeriodo}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          valueColor="text-emerald-600"
          subtitle="Compareceram à experimental"
        />

        <KPICard
          variant="dashboard"
          title="Fechamento no Dia"
          value={`${taxaConversaoMesmoDia}%`}
          icon={Zap}
          iconColor="text-pink-500"
          valueColor="text-pink-600"
          subtitle={`${periodStats.conversaoMesmoDia} fechou no mesmo dia`}
        />

        <KPICard
          variant="dashboard"
          title="Matrículas no Período"
          value={periodStats.matriculasPeriodo}
          icon={Award}
          iconColor="text-amber-500"
          valueColor="text-amber-600"
          subtitle="Período selecionado"
          onClick={onMatriculasClick}
          isActive={showMatriculasSection}
          activeColor="amber"
        />
      </div>

      {/* Linha 2 — Operacional / Retenção */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FollowUpKPI
          pendingCount={followUpPendingCount}
          d1Count={followUpD1Count}
          onClick={onFollowUpClick}
          isActive={showFollowUpSection}
        />

        <VencimentosKPI summary={summary} />

        <KPICard
          variant="dashboard"
          title="Não Compareceram"
          value={naoCompareceram}
          icon={UserX}
          iconColor="text-blue-500"
          valueColor="text-blue-600"
          subtitle="No período"
        />

        <TaxaComparecimentoKPI
          comparecimentos={periodStats.comparecimentosPeriodo}
          agendados={periodStats.experimentaisPeriodo}
        />
      </div>
    </div>
  );
});

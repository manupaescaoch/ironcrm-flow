import React, { memo } from 'react';
import { Users, CalendarCheck, Calendar, Award, AlertTriangle, UserCheck, CheckCircle2, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/components/ui/kpi-card';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
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
      title="Alunos Ativos"
      value={alunosAtivos}
      icon={UserCheck}
      iconColor="text-green-500"
      valueColor="text-green-600"
      subtitle={`${emDia} em dia, ${precisamAtencao} em atenção`}
      onClick={handleClick}
      showClickHint
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
      title="Planos Vencendo"
      value={urgentCount + attentionCount}
      icon={AlertTriangle}
      iconColor={colorClasses[color].icon}
      valueColor={colorClasses[color].value}
      subtitle={subtitle}
      onClick={handleClick}
      showClickHint
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8 gap-4 mb-8">
      <KPICard
        title="Total de Leads"
        value={stats.total}
        icon={Users}
      />

      <KPICard
        title="Aulas Agendadas"
        value={periodStats.experimentaisPeriodo}
        icon={CalendarCheck}
        iconColor="text-sky-500"
        valueColor="text-sky-600"
        subtitle="No período"
      />

      <KPICard
        title="Comparecimentos"
        value={periodStats.comparecimentosPeriodo}
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        valueColor="text-emerald-600"
        subtitle="Compareceram à experimental"
      />

      <KPICard
        title="Fechamento no Dia"
        value={`${taxaConversaoMesmoDia}%`}
        icon={Zap}
        iconColor="text-pink-500"
        valueColor="text-pink-600"
        subtitle={`${periodStats.conversaoMesmoDia} fechou no mesmo dia`}
      />

      <FollowUpKPI
        pendingCount={followUpPendingCount}
        d1Count={followUpD1Count}
        onClick={onFollowUpClick}
        isActive={showFollowUpSection}
      />

      <KPICard
        title="Experimentais da Semana"
        value={experimentaisSemanaCount}
        icon={Calendar}
        iconColor="text-purple-500"
        valueColor="text-purple-600"
        onClick={onExperimentaisClick}
        isActive={showExperimentaisSection}
        activeColor="purple"
        showClickHint
      />

      <KPICard
        title="Matrículas no Período"
        value={periodStats.matriculasPeriodo}
        icon={Award}
        iconColor="text-amber-500"
        valueColor="text-amber-600"
        onClick={onMatriculasClick}
        isActive={showMatriculasSection}
        activeColor="amber"
        showClickHint
      />

      <VencimentosKPI summary={summary} />
    </div>
  );
});

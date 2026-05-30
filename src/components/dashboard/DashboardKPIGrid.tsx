import React, { memo } from 'react';
import { Users, CalendarCheck, Calendar, Award, CheckCircle2, Zap, UserX } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { TaxaComparecimentoKPI } from '@/components/dashboard/TaxaComparecimentoKPI';
import { Stats, PeriodStats } from '@/components/dashboard/constants';


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

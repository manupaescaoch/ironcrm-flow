import React, { memo } from 'react';
import { Users, UserPlus, CalendarCheck, Calendar, Award } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      <KPICard
        title="Total de Leads"
        value={stats.total}
        icon={Users}
      />

      <KPICard
        title="Leads Novos"
        value={stats.novos}
        icon={UserPlus}
        iconColor="text-blue-500"
        valueColor="text-blue-600"
      />

      <KPICard
        title="Aulas Agendadas"
        value={periodStats.experimentaisPeriodo}
        icon={CalendarCheck}
        iconColor="text-sky-500"
        valueColor="text-sky-600"
        subtitle="No período"
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
    </div>
  );
});

import React, { memo } from 'react';
import { Users, CalendarCheck, Calendar, Award, CheckCircle2, Filter, UserX } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { FollowUpMatriculadosKPI } from '@/components/dashboard/FollowUpMatriculadosKPI';
import { FollowUpGerenteKPI } from '@/components/dashboard/FollowUpGerenteKPI';
import { TaxaComparecimentoKPI } from '@/components/dashboard/TaxaComparecimentoKPI';
import { FunilComercialCard } from '@/components/dashboard/FunilComercialCard';
import { DiagnosticoSemanaCard } from '@/components/dashboard/DiagnosticoSemanaCard';
import { AlunosAtivosKPI } from '@/components/dashboard/AlunosAtivosKPI';
import { Stats, PeriodStats } from '@/components/dashboard/constants';



interface DashboardKPIGridProps {
  stats: Stats;
  periodStats: PeriodStats;
  experimentaisSemanaCount: number;
  unidadeId: string | undefined;
  alunosAtivosRefreshKey?: number;
  onAlunosAtivosChange?: () => void;
  followUpPendingCount: number;
  followUpD1Count: number;
  followUpMatriculadosCount: number;
  followUpGerenteCount: number;
  showExperimentaisSection: boolean;
  showMatriculasSection: boolean;
  showFollowUpSection: boolean;
  showFollowUpMatriculadosSection: boolean;
  showFollowUpGerenteSection: boolean;
  onExperimentaisClick: () => void;
  onMatriculasClick: () => void;
  onFollowUpClick: () => void;
  onFollowUpMatriculadosClick: () => void;
  onFollowUpGerenteClick: () => void;
  onNaoCompareceramClick?: () => void;
  isNaoCompareceramActive?: boolean;

}



export const DashboardKPIGrid = memo(function DashboardKPIGrid({
  stats,
  periodStats,
  experimentaisSemanaCount,
  unidadeId,
  alunosAtivosRefreshKey,
  onAlunosAtivosChange,
  followUpPendingCount,
  followUpD1Count,
  followUpMatriculadosCount,
  followUpGerenteCount,
  showExperimentaisSection,
  showMatriculasSection,
  showFollowUpSection,
  showFollowUpMatriculadosSection,
  showFollowUpGerenteSection,
  onExperimentaisClick,
  onMatriculasClick,
  onFollowUpClick,
  onFollowUpMatriculadosClick,
  onFollowUpGerenteClick,
  onNaoCompareceramClick,
  isNaoCompareceramActive,
}: DashboardKPIGridProps) {

  const naoCompareceram = Math.max(
    0,
    periodStats.experimentaisPeriodo - periodStats.comparecimentosPeriodo
  );

  const taxaConversao = stats.total > 0
    ? Math.round((periodStats.matriculasPeriodo / stats.total) * 100)
    : 0;



  return (
    <div className="space-y-2 mb-2">
      {/* Linha 1 — KPIs principais (6) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">

        <AlunosAtivosKPI
          unidadeId={unidadeId}
          refreshKey={alunosAtivosRefreshKey}
          onChange={onAlunosAtivosChange}
        />

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
          title={"Compareci\u00ADmentos"}
          value={periodStats.comparecimentosPeriodo}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          valueColor="text-emerald-600"
          subtitle="Compareceram à experimental"
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

        <KPICard
          variant="dashboard"
          title="Taxa de Conversão"
          value={`${taxaConversao}%`}
          icon={Filter}
          iconColor="text-pink-500"
          valueColor="text-pink-600"
          subtitle="Leads → Matrículas"
        />
      </div>

      {/* Linha 2 — Funil Comercial + Diagnóstico da Semana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <FunilComercialCard
          leads={stats.total}
          agendamentos={periodStats.experimentaisPeriodo}
          comparecimentos={periodStats.comparecimentosPeriodo}
          matriculas={periodStats.matriculasPeriodo}
          conversaoMesmoDia={periodStats.conversaoMesmoDia}
          ticketMedioMes={periodStats.ticketMedioMes}
          matriculasMes={periodStats.matriculasMes}
        />
        <DiagnosticoSemanaCard
          leads={stats.total}
          agendamentos={periodStats.experimentaisPeriodo}
          comparecimentos={periodStats.comparecimentosPeriodo}
          matriculas={periodStats.matriculasPeriodo}
        />
      </div>

      {/* Linha 3 — Operação do Dia */}
      <div>
        <h2 className="text-xs font-semibold text-foreground/80 mb-1 px-1">Operação do Dia</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-6 gap-2">

          <FollowUpKPI
            pendingCount={followUpPendingCount}
            d1Count={followUpD1Count}
            onClick={onFollowUpClick}
            isActive={showFollowUpSection}
          />

          <FollowUpMatriculadosKPI
            pendingCount={followUpMatriculadosCount}
            onClick={onFollowUpMatriculadosClick}
            isActive={showFollowUpMatriculadosSection}
          />

          <FollowUpGerenteKPI
            pendingCount={followUpGerenteCount}
            onClick={onFollowUpGerenteClick}
            isActive={showFollowUpGerenteSection}
          />

          <KPICard
            variant="dashboard"
            title="Não Compareceram"
            value={naoCompareceram}
            icon={UserX}
            iconColor="text-blue-500"
            valueColor="text-blue-600"
            subtitle="No período"
            onClick={onNaoCompareceramClick}
            isActive={isNaoCompareceramActive}
            activeColor="blue"
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

          <TaxaComparecimentoKPI
            comparecimentos={periodStats.comparecimentosPeriodo}
            agendados={periodStats.experimentaisPeriodo}
          />
        </div>
      </div>
    </div>
  );
});

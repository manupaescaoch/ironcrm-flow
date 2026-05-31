import React, { memo } from 'react';
import { Users, CalendarCheck, Calendar, Award, CheckCircle2, DollarSign, Filter, UserX } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { TaxaComparecimentoKPI } from '@/components/dashboard/TaxaComparecimentoKPI';
import { FunilComercialCard } from '@/components/dashboard/FunilComercialCard';
import { DiagnosticoSemanaCard } from '@/components/dashboard/DiagnosticoSemanaCard';
import { Stats, PeriodStats } from '@/components/dashboard/constants';


interface DashboardKPIGridProps {
  stats: Stats;
  periodStats: PeriodStats;
  experimentaisSemanaCount: number;
  faturamentoPeriodo: number;
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
  faturamentoPeriodo,
  followUpPendingCount,
  followUpD1Count,
  showExperimentaisSection,
  showMatriculasSection,
  showFollowUpSection,
  onExperimentaisClick,
  onMatriculasClick,
  onFollowUpClick,
}: DashboardKPIGridProps) {
  const naoCompareceram = Math.max(
    0,
    periodStats.experimentaisPeriodo - periodStats.comparecimentosPeriodo
  );

  const taxaConversao = stats.total > 0
    ? Math.round((periodStats.matriculasPeriodo / stats.total) * 100)
    : 0;

  const faturamentoFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(faturamentoPeriodo || 0);

  return (
    <div className="space-y-2 mb-2">
      {/* Linha 1 — KPIs principais (6) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">

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
          title="Faturamento"
          value={faturamentoFormatado}
          icon={DollarSign}
          iconColor="text-purple-500"
          valueColor="text-purple-600"
          subtitle="Período selecionado"
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
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2">

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

import React, { memo } from 'react';
import { Users, CalendarCheck, Award, CheckCircle2, Filter, Percent, TrendingUp } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { FunilComercialCard } from '@/components/dashboard/FunilComercialCard';
import { DiagnosticoSemanaCard } from '@/components/dashboard/DiagnosticoSemanaCard';
import { AlunosAtivosKPI } from '@/components/dashboard/AlunosAtivosKPI';
import { Stats, PeriodStats } from '@/components/dashboard/constants';

interface DashboardKPIGridProps {
  stats: Stats;
  periodStats: PeriodStats;
  unidadeId: string | undefined;
  alunosAtivosRefreshKey?: number;
  onAlunosAtivosChange?: () => void;
  showMatriculasSection: boolean;
  onMatriculasClick: () => void;
}

export const DashboardKPIGrid = memo(function DashboardKPIGrid({
  stats,
  periodStats,
  unidadeId,
  alunosAtivosRefreshKey,
  onAlunosAtivosChange,
  showMatriculasSection,
  onMatriculasClick,
}: DashboardKPIGridProps) {

  const taxaConversao = stats.total > 0
    ? Math.round((periodStats.matriculasPeriodo / stats.total) * 100)
    : 0;

  const leadToExperimentalPct = stats.total > 0
    ? Math.round((periodStats.experimentaisPeriodo / stats.total) * 100)
    : 0;

  const comparecimentoPct = periodStats.experimentaisPeriodo > 0
    ? Math.round((periodStats.comparecimentosPeriodo / periodStats.experimentaisPeriodo) * 100)
    : 0;

  const experimentalToMatriculaPct = periodStats.experimentaisPeriodo > 0
    ? Math.round((periodStats.matriculasPeriodo / periodStats.experimentaisPeriodo) * 100)
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
          title="Experimentais Agendadas"
          value={periodStats.experimentaisPeriodo}
          icon={CalendarCheck}
          iconColor="text-sky-500"
          valueColor="text-sky-600"
          subtitle="No período"
        />

        <KPICard
          variant="dashboard"
          title="Compareceram"
          value={periodStats.comparecimentosPeriodo}
          icon={CheckCircle2}
          iconColor="text-emerald-500"
          valueColor="text-emerald-600"
          subtitle="Compareceram à experimental"
        />

        <KPICard
          variant="dashboard"
          title="Matrículas"
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
          title="Conversão Geral"
          value={`${taxaConversao}%`}
          icon={Filter}
          iconColor="text-pink-500"
          valueColor="text-pink-600"
          subtitle="Leads → Matrículas"
        />
      </div>

      {/* Linha 1.5 — Taxas do Funil */}
      <div>
        <h2 className="text-xs font-semibold text-foreground/80 mb-1 px-1">Taxas do Funil</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <KPICard
            variant="dashboard"
            title="Lead vira Experimental"
            value={`${leadToExperimentalPct}%`}
            icon={TrendingUp}
            iconColor="text-indigo-500"
            valueColor="text-indigo-600"
            subtitle={`${periodStats.experimentaisPeriodo} de ${stats.total} leads`}
          />
          <KPICard
            variant="dashboard"
            title="Comparecimento"
            value={`${comparecimentoPct}%`}
            icon={Percent}
            iconColor="text-teal-500"
            valueColor="text-teal-600"
            subtitle={`${periodStats.comparecimentosPeriodo} de ${periodStats.experimentaisPeriodo} agendadas`}
          />
          <KPICard
            variant="dashboard"
            title="Experimental vira Matrícula"
            value={`${experimentalToMatriculaPct}%`}
            icon={Award}
            iconColor="text-amber-500"
            valueColor="text-amber-600"
            subtitle={`${periodStats.matriculasPeriodo} de ${periodStats.experimentaisPeriodo} experimentais`}
          />
        </div>
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
    </div>

  );
});

import React, { memo } from 'react';
import { 
  Users, 
  CalendarCheck, 
  UserCheck, 
  GraduationCap, 
  Percent, 
  TrendingUp,
  DollarSign,
  Receipt,
  Gem,
  CircleDollarSign,
  BadgeDollarSign
} from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { TopCards } from '@/components/executivo/constants';

interface ExecutivoKPIGridProps {
  topCards: TopCards;
  investimentoMarketing?: number;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const ExecutivoKPIGrid = memo(function ExecutivoKPIGrid({ 
  topCards, 
  investimentoMarketing = 0 
}: ExecutivoKPIGridProps) {
  // Calculate CPL and CPA based on investment input
  const cpl = investimentoMarketing > 0 && topCards.leadsDoMes > 0 
    ? investimentoMarketing / topCards.leadsDoMes 
    : null;
    
  const cpa = investimentoMarketing > 0 && topCards.matriculas > 0 
    ? investimentoMarketing / topCards.matriculas 
    : null;

  return (
    <div className="space-y-4">
      {/* Row 1: Volume Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard
          title="Leads do Mês"
          value={topCards.leadsDoMes}
          icon={Users}
          iconColor="text-blue-500"
          variant="compact"
        />

        <KPICard
          title="Agendamentos"
          value={topCards.agendamentos}
          icon={CalendarCheck}
          iconColor="text-amber-500"
          variant="compact"
        />

        <KPICard
          title="Comparecimentos"
          value={topCards.comparecimentos}
          icon={UserCheck}
          iconColor="text-purple-500"
          variant="compact"
        />

        <KPICard
          title="Matrículas"
          value={topCards.matriculas}
          icon={GraduationCap}
          iconColor="text-green-500"
          variant="compact"
        />

        <KPICard
          title="Faturamento"
          value={formatCurrency(topCards.faturamentoTotal)}
          icon={DollarSign}
          iconColor="text-emerald-500"
          variant="compact"
        />
      </div>

      {/* Row 2: Conversion & Cost Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Lead → Atendimento"
          value={`${topCards.taxaLeadAtendimento.toFixed(1)}%`}
          icon={TrendingUp}
          iconColor="text-blue-500"
          variant="compact"
        />

        <KPICard
          title="Atendimento → Aluno"
          value={`${topCards.taxaConversao.toFixed(1)}%`}
          icon={Percent}
          iconColor="text-cyan-500"
          variant="compact"
        />

        <KPICard
          title="CPL"
          value={cpl ? formatCurrency(cpl) : '-'}
          icon={CircleDollarSign}
          iconColor="text-orange-500"
          variant="compact"
          subtitle={!cpl ? "Informe investimento" : undefined}
        />

        <KPICard
          title="CPA"
          value={cpa ? formatCurrency(cpa) : '-'}
          icon={BadgeDollarSign}
          iconColor="text-red-500"
          variant="compact"
          subtitle={!cpa ? "Informe investimento" : undefined}
        />

        <KPICard
          title="Ticket Médio"
          value={formatCurrency(topCards.ticketMedio)}
          icon={Receipt}
          iconColor="text-teal-500"
          variant="compact"
        />

        <KPICard
          title="LTV (8 meses)"
          value={formatCurrency(topCards.ltv)}
          icon={Gem}
          iconColor="text-purple-500"
          variant="compact"
        />
      </div>
    </div>
  );
});

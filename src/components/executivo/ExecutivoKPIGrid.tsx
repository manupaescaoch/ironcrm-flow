import React, { memo } from 'react';
import { Users, CalendarCheck, UserCheck, GraduationCap, Percent } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { TopCards } from '@/components/executivo/constants';

interface ExecutivoKPIGridProps {
  topCards: TopCards;
}

export const ExecutivoKPIGrid = memo(function ExecutivoKPIGrid({ topCards }: ExecutivoKPIGridProps) {
  return (
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
        title="Taxa Conversão"
        value={`${topCards.taxaConversao.toFixed(1)}%`}
        icon={Percent}
        iconColor="text-cyan-500"
        variant="compact"
      />
    </div>
  );
});

import React, { memo } from 'react';
import { Users, TrendingUp, Briefcase, UserCheck, Award, DollarSign } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { ComissaoStats, TreinadorStats } from './constants';
import { formatComissaoCurrency } from '@/utils/comissoesMappers';

interface ComissoesKPIGridProps {
  stats: ComissaoStats;
  treinadorStats: TreinadorStats;
  totalComissoes: number;
}

export const ComissoesKPIGrid = memo(function ComissoesKPIGrid({
  stats,
  treinadorStats,
  totalComissoes,
}: ComissoesKPIGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <KPICard
        title="Matrículas"
        value={stats.totalMatriculas}
        icon={Users}
        iconColor="text-blue-600"
        variant="compact"
      />

      <KPICard
        title="Ticket Médio"
        value={formatComissaoCurrency(stats.ticketMedio)}
        icon={TrendingUp}
        iconColor="text-purple-600"
        variant="compact"
      />

      <KPICard
        title="Cadastrador (3%)"
        value={formatComissaoCurrency(stats.totalComissaoCadastrador)}
        icon={Briefcase}
        iconColor="text-green-600"
        valueColor="text-green-600"
        variant="compact"
      />

      <KPICard
        title="Fechador (2%)"
        value={formatComissaoCurrency(stats.totalComissaoFechador)}
        icon={UserCheck}
        iconColor="text-amber-600"
        valueColor="text-amber-600"
        variant="compact"
      />

      <KPICard
        title="Bônus Treinador"
        value={formatComissaoCurrency(treinadorStats.totalBonus)}
        icon={Award}
        iconColor="text-blue-700"
        valueColor="text-blue-600"
        variant="compact"
      />

      <KPICard
        title="Total Comissões"
        value={formatComissaoCurrency(totalComissoes)}
        icon={DollarSign}
        variant="highlight"
      />
    </div>
  );
});

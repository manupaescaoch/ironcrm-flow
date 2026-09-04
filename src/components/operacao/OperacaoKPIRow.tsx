import { memo } from 'react';
import { Calendar, UserX } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { FollowUpMatriculadosKPI } from '@/components/dashboard/FollowUpMatriculadosKPI';
import { FollowUpGerenteKPI } from '@/components/dashboard/FollowUpGerenteKPI';
import { TaxaComparecimentoKPI } from '@/components/dashboard/TaxaComparecimentoKPI';

interface OperacaoKPIRowProps {
  followUpPendingCount: number;
  followUpD1Count: number;
  followUpMatriculadosCount: number;
  followUpGerenteCount: number;
  naoCompareceram: number;
  experimentaisSemanaCount: number;
  comparecimentos: number;
  agendados: number;
  showFollowUpSection: boolean;
  showFollowUpMatriculadosSection: boolean;
  showFollowUpGerenteSection: boolean;
  showExperimentaisSemana: boolean;
  isNaoCompareceramActive?: boolean;
  onFollowUpClick: () => void;
  onFollowUpMatriculadosClick: () => void;
  onFollowUpGerenteClick: () => void;
  onNaoCompareceramClick: () => void;
  onExperimentaisClick: () => void;
}

export const OperacaoKPIRow = memo(function OperacaoKPIRow({
  followUpPendingCount,
  followUpD1Count,
  followUpMatriculadosCount,
  followUpGerenteCount,
  naoCompareceram,
  experimentaisSemanaCount,
  comparecimentos,
  agendados,
  showFollowUpSection,
  showFollowUpMatriculadosSection,
  showFollowUpGerenteSection,
  showExperimentaisSemana,
  isNaoCompareceramActive,
  onFollowUpClick,
  onFollowUpMatriculadosClick,
  onFollowUpGerenteClick,
  onNaoCompareceramClick,
  onExperimentaisClick,
}: OperacaoKPIRowProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
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
        isActive={showExperimentaisSemana}
        activeColor="purple"
      />
      <TaxaComparecimentoKPI comparecimentos={comparecimentos} agendados={agendados} />
    </div>
  );
});

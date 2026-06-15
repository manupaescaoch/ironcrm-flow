import { UserCheck } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';

interface Props {
  pendingCount: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function FollowUpMatriculadosKPI({ pendingCount, onClick, isActive }: Props) {
  const color = pendingCount === 0
    ? 'text-green-600'
    : pendingCount <= 3
      ? 'text-orange-500'
      : 'text-red-600';

  const iconColor = pendingCount === 0
    ? 'text-green-500'
    : pendingCount <= 3
      ? 'text-orange-500'
      : 'text-red-500';

  const subtitle = pendingCount === 0
    ? 'Sem pendências'
    : `${pendingCount} aguardando contato`;

  return (
    <KPICard
      variant="dashboard"
      title="FU Matriculados"
      value={pendingCount}
      icon={UserCheck}
      iconColor={iconColor}
      valueColor={color}
      subtitle={subtitle}
      onClick={onClick}
      isActive={isActive}
      activeColor={pendingCount === 0 ? 'green' : 'amber'}
    />
  );
}

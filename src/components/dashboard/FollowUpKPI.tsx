import { MessageCircle } from 'lucide-react';
import { KPICard } from '@/components/ui/kpi-card';

interface FollowUpKPIProps {
  pendingCount: number;
  d1Count?: number;
  onClick?: () => void;
  isActive?: boolean;
}

export function FollowUpKPI({ pendingCount, d1Count = 0, onClick, isActive }: FollowUpKPIProps) {
  const colorClass = d1Count > 0
    ? 'text-emerald-600'
    : pendingCount === 0
    ? 'text-green-600'
    : pendingCount <= 3
    ? 'text-orange-500'
    : 'text-red-600';

  const iconColor = d1Count > 0
    ? 'text-emerald-500'
    : pendingCount === 0
    ? 'text-green-500'
    : pendingCount <= 3
    ? 'text-orange-500'
    : 'text-red-500';

  const subtitle = d1Count > 0
    ? `⚡ ${d1Count} D+1 — Prioridade`
    : pendingCount === 0
    ? 'Sem pendências'
    : `${pendingCount} aguardando`;

  return (
    <KPICard
      variant="dashboard"
      title="Follow Ups Pendentes"
      value={pendingCount}
      icon={MessageCircle}
      iconColor={iconColor}
      valueColor={colorClass}
      subtitle={subtitle}
      onClick={onClick}
      isActive={isActive}
      activeColor={d1Count > 0 ? 'green' : pendingCount === 0 ? 'green' : 'amber'}
    />
  );
}


import React, { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, CalendarCheck, Calendar, Award, ChevronDown } from 'lucide-react';
import { FollowUpKPI } from '@/components/dashboard/FollowUpKPI';
import { cn } from '@/lib/utils';
import { Stats, PeriodStats } from '@/components/dashboard/constants';

interface DashboardKPIGridProps {
  stats: Stats;
  periodStats: PeriodStats;
  experimentaisSemanaCount: number;
  followUpPendingCount: number;
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
  showExperimentaisSection,
  showMatriculasSection,
  showFollowUpSection,
  onExperimentaisClick,
  onMatriculasClick,
  onFollowUpClick,
}: DashboardKPIGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total de Leads
          </CardTitle>
          <Users className="w-5 h-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{stats.total}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Leads Novos
          </CardTitle>
          <UserPlus className="w-5 h-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-blue-600">{stats.novos}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Aulas Agendadas
          </CardTitle>
          <CalendarCheck className="w-5 h-5 text-sky-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-sky-600">{periodStats.experimentaisPeriodo}</p>
          <p className="text-xs text-muted-foreground mt-1">No período</p>
        </CardContent>
      </Card>

      <FollowUpKPI
        pendingCount={followUpPendingCount}
        onClick={onFollowUpClick}
        isActive={showFollowUpSection}
      />

      <Card 
        className={cn(
          "cursor-pointer transition-all hover:shadow-md hover:border-purple-300",
          showExperimentaisSection && "ring-2 ring-purple-500 border-purple-500"
        )}
        onClick={onExperimentaisClick}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Experimentais da Semana
          </CardTitle>
          <Calendar className="w-5 h-5 text-purple-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-purple-600">{experimentaisSemanaCount}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            Clique para ver detalhes <ChevronDown className="w-3 h-3" />
          </p>
        </CardContent>
      </Card>

      <Card 
        className={cn(
          "cursor-pointer transition-all hover:shadow-md hover:border-amber-300",
          showMatriculasSection && "ring-2 ring-amber-500 border-amber-500"
        )}
        onClick={onMatriculasClick}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Matrículas no Período
          </CardTitle>
          <Award className="w-5 h-5 text-amber-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-amber-600">{periodStats.matriculasPeriodo}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            Clique para ver detalhes <ChevronDown className="w-3 h-3" />
          </p>
        </CardContent>
      </Card>
    </div>
  );
});

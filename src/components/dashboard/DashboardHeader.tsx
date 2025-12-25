import React, { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter';

interface DashboardHeaderProps {
  unidadeNome?: string;
  startDate: Date;
  endDate: Date;
  periodType: 'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom';
  onStartDateChange: (date: Date) => void;
  onEndDateChange: (date: Date) => void;
  onPeriodTypeChange: (type: 'all' | 'last7days' | 'currentMonth' | 'lastMonth' | 'custom') => void;
}

export const DashboardHeader = memo(function DashboardHeader({
  unidadeNome,
  startDate,
  endDate,
  periodType,
  onStartDateChange,
  onEndDateChange,
  onPeriodTypeChange,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {unidadeNome && (
          <Badge variant="outline" className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary border-primary/20">
            {unidadeNome}
          </Badge>
        )}
      </div>
      <DateRangeFilter
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        periodType={periodType}
        onPeriodTypeChange={onPeriodTypeChange}
      />
    </div>
  );
});

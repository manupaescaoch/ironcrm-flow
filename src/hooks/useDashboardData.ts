import { useCallback, useEffect, useState } from 'react';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useDashboardStats } from './useDashboardStats';
import { useDashboardEventos } from './useDashboardEventos';
import { useDashboardFollowUps } from './useDashboardFollowUps';
import { useDashboardMatriculas } from './useDashboardMatriculas';

interface UseDashboardDataReturn {
  // Stats
  stats: ReturnType<typeof useDashboardStats>['stats'];
  periodStats: ReturnType<typeof useDashboardStats>['periodStats'];
  experimentaisSemanaCount: number;
  
  // Eventos
  eventosHoje: ReturnType<typeof useDashboardEventos>['eventosHoje'];
  confirmacoesAmanha: ReturnType<typeof useDashboardEventos>['confirmacoesAmanha'];
  pendenciasHoje: ReturnType<typeof useDashboardEventos>['pendenciasHoje'];
  pendenciasAmanha: ReturnType<typeof useDashboardEventos>['pendenciasAmanha'];
  experimentaisSemana: ReturnType<typeof useDashboardEventos>['experimentaisSemana'];
  experimentaisDetalhados: ReturnType<typeof useDashboardEventos>['experimentaisDetalhados'];
  
  // Follow-ups
  followUpItems: ReturnType<typeof useDashboardFollowUps>['followUpItems'];
  autoFollowUpItems: ReturnType<typeof useDashboardFollowUps>['autoFollowUpItems'];
  lastSyncTime: Date | null;
  
  // Matrículas
  matriculasDetalhadas: ReturnType<typeof useDashboardMatriculas>['matriculasDetalhadas'];
  
  // Loading state
  loading: boolean;
  
  // Actions
  refetchAll: (startDate: Date, endDate: Date) => Promise<void>;
  refetchEventos: (startDate: Date, endDate: Date) => Promise<void>;
}

export function useDashboardData(
  startDate: Date,
  endDate: Date
): UseDashboardDataReturn {
  const { unidadeAtual, loading: unidadeLoading } = useUnidade();
  const [loading, setLoading] = useState(true);
  
  const statsHook = useDashboardStats();
  const eventosHook = useDashboardEventos();
  const followUpsHook = useDashboardFollowUps();
  const matriculasHook = useDashboardMatriculas();

  const refetchAll = useCallback(async (start: Date, end: Date) => {
    if (unidadeLoading || !unidadeAtual) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    await Promise.all([
      statsHook.fetchStats(),
      statsHook.fetchPeriodStats(start, end),
      statsHook.fetchWeeklyStats(),
      eventosHook.fetchEventos(start, end),
      matriculasHook.fetchMatriculas(start, end),
      followUpsHook.fetchFollowUp(),
      followUpsHook.fetchAutoFollowUps(),
    ]);
    setLoading(false);
  }, [
    unidadeLoading,
    unidadeAtual,
    statsHook.fetchStats,
    statsHook.fetchPeriodStats,
    statsHook.fetchWeeklyStats,
    eventosHook.fetchEventos,
    matriculasHook.fetchMatriculas,
    followUpsHook.fetchFollowUp,
    followUpsHook.fetchAutoFollowUps,
  ]);

  const refetchEventos = useCallback(async (start: Date, end: Date) => {
    await eventosHook.fetchEventos(start, end);
  }, [eventosHook.fetchEventos]);

  // Initial fetch - generate follow-ups only once
  useEffect(() => {
    if (unidadeAtual) {
      followUpsHook.generateFollowUps();
    }
    refetchAll(startDate, endDate);
  }, [unidadeAtual, startDate, endDate]);

  return {
    stats: statsHook.stats,
    periodStats: statsHook.periodStats,
    experimentaisSemanaCount: statsHook.experimentaisSemanaCount,
    eventosHoje: eventosHook.eventosHoje,
    confirmacoesAmanha: eventosHook.confirmacoesAmanha,
    pendenciasHoje: eventosHook.pendenciasHoje,
    pendenciasAmanha: eventosHook.pendenciasAmanha,
    experimentaisSemana: eventosHook.experimentaisSemana,
    experimentaisDetalhados: eventosHook.experimentaisDetalhados,
    followUpItems: followUpsHook.followUpItems,
    autoFollowUpItems: followUpsHook.autoFollowUpItems,
    lastSyncTime: followUpsHook.lastSyncTime,
    matriculasDetalhadas: matriculasHook.matriculasDetalhadas,
    loading: loading || unidadeLoading,
    refetchAll,
    refetchEventos,
  };
}

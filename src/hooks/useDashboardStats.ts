import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Lead } from '@/types/database';
import { Stats, PeriodStats } from '@/components/dashboard/constants';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface UseDashboardStatsReturn {
  stats: Stats;
  periodStats: PeriodStats;
  experimentaisSemanaCount: number;
  loading: boolean;
  fetchStats: () => Promise<void>;
  fetchPeriodStats: (startDate: Date, endDate: Date) => Promise<void>;
  fetchWeeklyStats: () => Promise<void>;
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const { unidadeAtual } = useUnidade();
  
  const [stats, setStats] = useState<Stats>({ total: 0, novos: 0, aulasAgendadas: 0 });
  const [periodStats, setPeriodStats] = useState<PeriodStats>({ experimentaisPeriodo: 0, matriculasPeriodo: 0 });
  const [experimentaisSemanaCount, setExperimentaisSemanaCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!unidadeAtual) return;
    
    setLoading(true);
    try {
      const { data: leads } = await supabase
        .from('leads')
        .select('*')
        .eq('ativo', true)
        .eq('unidade_id', unidadeAtual.id);

      if (leads) {
        const typedLeads = leads as unknown as Lead[];
        setStats({
          total: typedLeads.length,
          novos: typedLeads.filter(l => l.status_funil === 'novo').length,
          aulasAgendadas: typedLeads.filter(l => l.status_funil === 'aula_agendada').length,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  const fetchPeriodStats = useCallback(async (startDate: Date, endDate: Date) => {
    if (!unidadeAtual) return;
    
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch experimental count for period - counting unique leads only
    const { data: experimentaisData } = await supabase
      .from('interacoes')
      .select('lead_id')
      .eq('agendou_experimental', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_experimental', startDateStr)
      .lte('data_experimental', endDateStr);

    const leadsUnicosExperimentais = new Set(experimentaisData?.map(e => e.lead_id) || []);

    // Fetch matriculas count for period - counting unique leads only
    const { data: matriculasData } = await supabase
      .from('interacoes')
      .select('lead_id')
      .eq('fechou_matricula', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr);

    const leadsUnicosMatriculados = new Set(matriculasData?.map(m => m.lead_id) || []);

    setPeriodStats({
      experimentaisPeriodo: leadsUnicosExperimentais.size,
      matriculasPeriodo: leadsUnicosMatriculados.size,
    });
  }, [unidadeAtual]);

  const fetchWeeklyStats = useCallback(async () => {
    if (!unidadeAtual) return;
    
    const now = new Date();
    const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    const { data: weeklyExperimentaisData } = await supabase
      .from('interacoes')
      .select('lead_id')
      .eq('agendou_experimental', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_experimental', weekStart)
      .lte('data_experimental', weekEnd);

    const leadsUnicosSemana = new Set(weeklyExperimentaisData?.map(e => e.lead_id) || []);
    setExperimentaisSemanaCount(leadsUnicosSemana.size);
  }, [unidadeAtual]);

  return {
    stats,
    periodStats,
    experimentaisSemanaCount,
    loading,
    fetchStats,
    fetchPeriodStats,
    fetchWeeklyStats,
  };
}

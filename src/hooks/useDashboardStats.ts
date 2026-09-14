import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { Stats, PeriodStats } from '@/components/dashboard/constants';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface UseDashboardStatsReturn {
  stats: Stats;
  periodStats: PeriodStats;
  experimentaisSemanaCount: number;
  loading: boolean;
  fetchStats: (startDate?: Date, endDate?: Date) => Promise<void>;
  fetchPeriodStats: (startDate: Date, endDate: Date) => Promise<void>;
  fetchWeeklyStats: () => Promise<void>;
}

export function useDashboardStats(): UseDashboardStatsReturn {
  const { unidadeAtual } = useUnidade();
  
  const [stats, setStats] = useState<Stats>({ total: 0, novos: 0, aulasAgendadas: 0 });
  const [periodStats, setPeriodStats] = useState<PeriodStats>({ experimentaisPeriodo: 0, comparecimentosPeriodo: 0, matriculasPeriodo: 0, conversaoMesmoDia: 0, ticketMedioMes: 0, matriculasMes: 0 });
  const [experimentaisSemanaCount, setExperimentaisSemanaCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchStats = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!unidadeAtual) return;
    
    setLoading(true);
    try {
      const applyFilters = (query: any) => {
        let filteredQuery = query
          .eq('ativo', true)
          .eq('unidade_id', unidadeAtual.id);

        if (startDate && endDate) {
          const startStr = format(startDate, 'yyyy-MM-dd');
          const endStr = format(endDate, 'yyyy-MM-dd');
          filteredQuery = filteredQuery
            .gte('created_at', `${startStr}T00:00:00`)
            .lte('created_at', `${endStr}T23:59:59`);
        }

        return filteredQuery;
      };

      const [totalResult, novosResult, aulasResult] = await Promise.all([
        applyFilters(supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })),
        applyFilters(supabase
          .from('leads')
          .select('id', { count: 'exact', head: true }))
          .eq('status_funil', 'novo'),
        applyFilters(supabase
          .from('leads')
          .select('id', { count: 'exact', head: true }))
          .eq('status_funil', 'aula_agendada'),
      ]);

      const queryError = totalResult.error ?? novosResult.error ?? aulasResult.error;
      if (queryError) throw queryError;

      setStats({
        total: totalResult.count ?? 0,
        novos: novosResult.count ?? 0,
        aulasAgendadas: aulasResult.count ?? 0,
      });
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
      .select('lead_id, compareceu, data_experimental')
      .eq('agendou_experimental', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_experimental', startDateStr)
      .lte('data_experimental', endDateStr);

    const leadsUnicosExperimentais = new Set(experimentaisData?.map(e => e.lead_id) || []);
    const leadsUnicosComparecimentos = new Set(
      experimentaisData?.filter(e => e.compareceu === true).map(e => e.lead_id) || []
    );

    // Map: lead_id -> data_experimental (do lead que compareceu)
    const dataExperimentalPorLead = new Map<string, string>();
    experimentaisData?.filter(e => e.compareceu === true && e.data_experimental).forEach(e => {
      dataExperimentalPorLead.set(e.lead_id, e.data_experimental as string);
    });

    // Fetch matriculas count for period - counting unique leads only
    const { data: matriculasData } = await supabase
      .from('interacoes')
      .select('lead_id, data_fechamento')
      .eq('fechou_matricula', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr);

    const leadsUnicosMatriculados = new Set(matriculasData?.map(m => m.lead_id) || []);

    // Conversão no mesmo dia: leads cuja data_fechamento === data_experimental (compareceu)
    const leadsConversaoMesmoDia = new Set<string>();
    matriculasData?.forEach(m => {
      const dataExp = dataExperimentalPorLead.get(m.lead_id);
      if (dataExp && m.data_fechamento === dataExp) {
        leadsConversaoMesmoDia.add(m.lead_id);
      }
    });

    // Ticket médio dos fechamentos do mês corrente
    const now = new Date();
    const mesStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
    const mesEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');

    const { data: matriculasMesData } = await supabase
      .from('interacoes')
      .select('lead_id, valor_plano')
      .eq('fechou_matricula', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_fechamento', mesStart)
      .lte('data_fechamento', mesEnd);

    const valoresPorLead = new Map<string, number>();
    matriculasMesData?.forEach(m => {
      if (!valoresPorLead.has(m.lead_id)) {
        valoresPorLead.set(m.lead_id, Number(m.valor_plano) || 0);
      }
    });
    const valores = Array.from(valoresPorLead.values()).filter(v => v > 0);
    const ticketMedioMes = valores.length > 0
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : 0;

    setPeriodStats({
      experimentaisPeriodo: leadsUnicosExperimentais.size,
      comparecimentosPeriodo: leadsUnicosComparecimentos.size,
      matriculasPeriodo: leadsUnicosMatriculados.size,
      conversaoMesmoDia: leadsConversaoMesmoDia.size,
      ticketMedioMes,
      matriculasMes: valores.length,
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

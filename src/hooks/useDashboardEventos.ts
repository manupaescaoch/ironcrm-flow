import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { EventoItem } from '@/components/dashboard/EventosHoje';
import { mapToEventoItem, sortEventosByTime } from '@/utils/dashboardMappers';
import { format, addDays } from 'date-fns';

interface UseDashboardEventosReturn {
  eventosHoje: EventoItem[];
  confirmacoesAmanha: EventoItem[];
  pendenciasHoje: EventoItem[];
  pendenciasAmanha: EventoItem[];
  experimentaisSemana: EventoItem[];
  experimentaisDetalhados: EventoItem[];
  loading: boolean;
  fetchEventos: (startDate: Date, endDate: Date) => Promise<void>;
}

export function useDashboardEventos(): UseDashboardEventosReturn {
  const { unidadeAtual } = useUnidade();
  
  const [eventosHoje, setEventosHoje] = useState<EventoItem[]>([]);
  const [confirmacoesAmanha, setConfirmacoesAmanha] = useState<EventoItem[]>([]);
  const [pendenciasHoje, setPendenciasHoje] = useState<EventoItem[]>([]);
  const [pendenciasAmanha, setPendenciasAmanha] = useState<EventoItem[]>([]);
  const [experimentaisSemana, setExperimentaisSemana] = useState<EventoItem[]>([]);
  const [experimentaisDetalhados, setExperimentaisDetalhados] = useState<EventoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const lastDateRangeRef = useRef<{ startDate: Date; endDate: Date } | null>(null);

  const fetchEventos = useCallback(async (startDate: Date, endDate: Date) => {
    if (!unidadeAtual) return;
    
    lastDateRangeRef.current = { startDate, endDate };
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      const minDate = startDateStr < today ? startDateStr : today;
      const maxDate = endDateStr > tomorrow ? endDateStr : tomorrow;

      // Fetch experimentais
      const { data: experimentaisData } = await supabase
        .from('interacoes')
        .select(`*, leads (id, nome, telefone, email, origem, status_funil, plano_escolhido, cadastrado_por, atendido_por, observacoes, data_aula_experimental, created_by, user_id, ativo, created_at, updated_at)`)
        .eq('agendou_experimental', true)
        .eq('unidade_id', unidadeAtual.id)
        .gte('data_experimental', minDate)
        .lte('data_experimental', maxDate);

      // Fetch avaliações físicas
      const { data: avaliacoesData } = await supabase
        .from('interacoes')
        .select(`*, leads (id, nome, telefone, email, origem, status_funil, plano_escolhido, cadastrado_por, atendido_por, observacoes, data_aula_experimental, created_by, user_id, ativo, created_at, updated_at)`)
        .eq('tipo', 'Avaliação Física')
        .eq('unidade_id', unidadeAtual.id)
        .gte('data_avaliacao', minDate)
        .lte('data_avaliacao', maxDate);

      const todayItems: EventoItem[] = [];
      const tomorrowItems: EventoItem[] = [];
      const pendenciasHojeItems: EventoItem[] = [];
      const pendenciasAmanhaItems: EventoItem[] = [];
      const weekItems: EventoItem[] = [];
      const detailedItems: EventoItem[] = [];

      const processItem = (item: any, tipoEvento: 'experimental' | 'avaliacao') => {
        const eventoItem = mapToEventoItem(item, tipoEvento);
        if (!eventoItem) return;
        
        const dataEvento = tipoEvento === 'avaliacao' 
          ? eventoItem.interacao.data_avaliacao 
          : eventoItem.interacao.data_experimental;
        const isAgendado = tipoEvento === 'avaliacao' 
          ? eventoItem.interacao.status_avaliacao === 'agendada'
          : eventoItem.interacao.compareceu !== true;

        if (dataEvento && dataEvento >= startDateStr && dataEvento <= endDateStr) {
          weekItems.push(eventoItem);
          if (tipoEvento === 'experimental') detailedItems.push(eventoItem);
        }

        if (dataEvento === today && isAgendado) {
          todayItems.push(eventoItem);
          pendenciasHojeItems.push(eventoItem);
        } else if (dataEvento === tomorrow && !eventoItem.interacao.confirmado) {
          tomorrowItems.push(eventoItem);
          pendenciasAmanhaItems.push(eventoItem);
        }
      };

      experimentaisData?.forEach(item => processItem(item, 'experimental'));
      avaliacoesData?.forEach(item => processItem(item, 'avaliacao'));

      setEventosHoje(todayItems.sort(sortEventosByTime));
      setConfirmacoesAmanha(tomorrowItems.sort(sortEventosByTime));
      setPendenciasHoje(pendenciasHojeItems.sort(sortEventosByTime));
      setPendenciasAmanha(pendenciasAmanhaItems.sort(sortEventosByTime));
      setExperimentaisSemana(weekItems);
      setExperimentaisDetalhados(detailedItems);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  // Realtime subscription for interacoes and leads tables
  useEffect(() => {
    if (!unidadeAtual) return;

    const handleRealtimeUpdate = () => {
      if (lastDateRangeRef.current) {
        console.log('Realtime update triggered - refetching eventos');
        fetchEventos(lastDateRangeRef.current.startDate, lastDateRangeRef.current.endDate);
      }
    };

    const interacoesChannel = supabase
      .channel('interacoes_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interacoes',
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        (payload) => {
          console.log('Interação realtime update:', payload.eventType);
          handleRealtimeUpdate();
        }
      )
      .subscribe();

    const leadsChannel = supabase
      .channel('leads_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        (payload) => {
          console.log('Lead realtime update:', payload.eventType);
          handleRealtimeUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(interacoesChannel);
      supabase.removeChannel(leadsChannel);
    };
  }, [unidadeAtual?.id, fetchEventos]);

  return {
    eventosHoje,
    confirmacoesAmanha,
    pendenciasHoje,
    pendenciasAmanha,
    experimentaisSemana,
    experimentaisDetalhados,
    loading,
    fetchEventos,
  };
}

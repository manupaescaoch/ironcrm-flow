import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { EventoItem } from '@/components/dashboard/EventosHoje';
import { FollowUpAutoItem } from '@/components/dashboard/AutoFollowUpCard';
import { mapToLead, mapToInteracao } from '@/utils/dashboardMappers';

interface UseDashboardFollowUpsReturn {
  followUpItems: EventoItem[];
  autoFollowUpItems: FollowUpAutoItem[];
  urgentAutoFollowUpItems: FollowUpAutoItem[];
  upcomingAutoFollowUpItems: FollowUpAutoItem[];
  loading: boolean;
  lastSyncTime: Date | null;
  fetchFollowUp: () => Promise<void>;
  fetchAutoFollowUps: () => Promise<void>;
  generateFollowUps: () => Promise<void>;
}

export function useDashboardFollowUps(): UseDashboardFollowUpsReturn {
  const { unidadeAtual } = useUnidade();
  
  const [followUpItems, setFollowUpItems] = useState<EventoItem[]>([]);
  const [autoFollowUpItems, setAutoFollowUpItems] = useState<FollowUpAutoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const hasGeneratedRef = useRef(false);

  // Separate follow-ups into urgent (today/overdue) and upcoming (future)
  const { urgentAutoFollowUpItems, upcomingAutoFollowUpItems } = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);
    
    const urgent: FollowUpAutoItem[] = [];
    const upcoming: FollowUpAutoItem[] = [];
    
    autoFollowUpItems.forEach(item => {
      const dataPrevista = new Date(item.data_prevista);
      if (dataPrevista <= hoje) {
        urgent.push(item);
      } else {
        upcoming.push(item);
      }
    });
    
    return { urgentAutoFollowUpItems: urgent, upcomingAutoFollowUpItems: upcoming };
  }, [autoFollowUpItems]);

  // Internal fetch function for realtime updates - NOW FETCHES ALL PENDING (no date filter)
  const fetchAutoFollowUpsInternal = useCallback(async () => {
    if (!unidadeAtual) return;
    
    const { data: followUpsData, error } = await supabase
      .from('follow_ups')
      .select(`
        id, lead_id, tipo, data_referencia, data_prevista, status, concluido_por, concluido_em,
        leads (id, nome, telefone, email, status_funil, is_matriculado)
      `)
      .eq('unidade_id', unidadeAtual.id)
      .eq('status', 'pendente')
      .order('data_prevista', { ascending: true });

    if (error) {
      console.error('Erro ao buscar follow-ups automáticos (realtime):', error);
      return;
    }

    // Collect valid follow-ups with SECURITY FILTER: is_matriculado has maximum priority
    const validFollowUps = followUpsData?.filter((item: any) => {
      if (!item.leads) return false;
      // REGRA DE SEGURANÇA: is_matriculado tem prioridade máxima
      if (item.leads.is_matriculado === true) return false;
      if (['perdido', 'convertido'].includes(item.leads.status_funil)) return false;
      return true;
    }) || [];

    const leadIds = validFollowUps.map((item: any) => item.lead_id);

    // Fetch last interaction for each lead
    let ultimaInteracaoMap: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: interacoesData } = await supabase
        .from('interacoes')
        .select('lead_id, data_interacao')
        .in('lead_id', leadIds)
        .order('data_interacao', { ascending: false });

      interacoesData?.forEach((i: any) => {
        if (!ultimaInteracaoMap[i.lead_id]) {
          ultimaInteracaoMap[i.lead_id] = i.data_interacao;
        }
      });
    }

    const items: FollowUpAutoItem[] = validFollowUps.map((item: any) => ({
      id: item.id,
      lead_id: item.lead_id,
      tipo: item.tipo,
      data_referencia: item.data_referencia,
      data_prevista: item.data_prevista,
      status: item.status,
      concluido_por: item.concluido_por,
      concluido_em: item.concluido_em,
      lead: {
        id: item.leads.id,
        nome: item.leads.nome,
        telefone: item.leads.telefone,
        email: item.leads.email,
        status_funil: item.leads.status_funil,
      },
      ultima_interacao: ultimaInteracaoMap[item.lead_id] || null,
    }));

    setAutoFollowUpItems(items);
    setLastSyncTime(new Date());
  }, [unidadeAtual]);

  const fetchFollowUp = useCallback(async () => {
    if (!unidadeAtual) return;
    
    setLoading(true);
    try {
      const { data: followUpData } = await supabase
        .from('interacoes')
        .select(`
          id, lead_id, tipo, descricao, data_interacao, created_at, created_by,
          atendido_por, atendido_por_tipo, agendou_experimental, data_experimental,
          hora_experimental, compareceu, confirmado, reagendou, fechou_matricula,
          plano_escolhido, valor_plano, comissao_comercial, comissao_recepcao,
          comissao_cadastrador, cadastrado_por, data_fechamento, responsavel_fechamento,
          treinador_responsavel, treinador_experimental, origem_fechamento, quem_agendou,
          tipo_atendimento, data_avaliacao, hora_avaliacao, status_avaliacao,
          leads (
            id, nome, email, telefone, origem, status_funil, plano_escolhido,
            data_aula_experimental, hora_aula_experimental, cadastrado_por, atendido_por,
            observacoes, created_by, user_id, ativo, created_at, updated_at,
            follow_up_whatsapp_enviado, follow_up_enviado_em, follow_up_responsavel,
            motivo_perda, data_perda, is_matriculado
          )
        `)
        .eq('compareceu', true)
        .eq('unidade_id', unidadeAtual.id)
        .not('fechou_matricula', 'eq', true);

      const items: EventoItem[] = [];
      followUpData?.forEach((interacaoData: any) => {
        if (!interacaoData.leads || interacaoData.leads.ativo === false) return;
        // REGRA DE SEGURANÇA: is_matriculado tem prioridade máxima
        if (interacaoData.leads.is_matriculado === true) return;
        if (['convertido', 'perdido'].includes(interacaoData.leads.status_funil)) return;
        // Skip leads that already had follow-up sent
        if (interacaoData.leads.follow_up_whatsapp_enviado === true) return;
        
        const lead = mapToLead(interacaoData.leads);
        const interacao = mapToInteracao(interacaoData);
        items.push({ lead, interacao, tipoEvento: 'experimental' });
      });

      // Check if any of these leads have closed matricula in other interacoes OR are converted
      const leadIds = items.map(i => i.lead.id);
      if (leadIds.length > 0) {
        // Check for closed matriculas
        const { data: matriculasData } = await supabase
          .from('interacoes')
          .select('lead_id')
          .in('lead_id', leadIds)
          .eq('fechou_matricula', true);
        
        // Also check current lead status (may have been updated after fetch)
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, status_funil')
          .in('id', leadIds)
          .in('status_funil', ['convertido', 'perdido']);
        
        const closedLeadIds = new Set(matriculasData?.map((m: any) => m.lead_id) || []);
        const convertedLeadIds = new Set(leadsData?.map((l: any) => l.id) || []);
        
        const filteredItems = items.filter(i => 
          !closedLeadIds.has(i.lead.id) && !convertedLeadIds.has(i.lead.id)
        );
        setFollowUpItems(filteredItems);
        setLastSyncTime(new Date());
      } else {
        setFollowUpItems(items);
        setLastSyncTime(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  // Realtime subscription for follow_ups, leads, and interacoes tables
  useEffect(() => {
    if (!unidadeAtual) return;

    const channel = supabase
      .channel('follow_ups_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_ups',
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        (payload) => {
          console.log('Follow-up realtime update:', payload.eventType);
          fetchAutoFollowUpsInternal();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        (payload) => {
          console.log('Leads realtime update (follow-ups):', payload.eventType);
          fetchFollowUp();
          fetchAutoFollowUpsInternal();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interacoes',
          filter: `unidade_id=eq.${unidadeAtual.id}`,
        },
        (payload) => {
          console.log('Interacoes realtime update (follow-ups):', payload.eventType);
          fetchFollowUp();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unidadeAtual?.id, fetchAutoFollowUpsInternal, fetchFollowUp]);

  // Separate function to generate follow-ups (called only once on initial load)
  const generateFollowUps = useCallback(async () => {
    if (!unidadeAtual || hasGeneratedRef.current) return;
    
    hasGeneratedRef.current = true;
    
    try {
      const { error } = await supabase.functions.invoke('generate-follow-ups', {
        body: { unidade_id: unidadeAtual.id }
      });
      
      if (error) {
        console.error('Erro ao gerar follow-ups:', error);
      }
    } catch (err) {
      console.error('Erro ao chamar edge function:', err);
    }
  }, [unidadeAtual]);

  // Fetch only - does NOT call generate-follow-ups - NOW FETCHES ALL PENDING (no date filter)
  const fetchAutoFollowUps = useCallback(async () => {
    if (!unidadeAtual) return;
    
    // Fetch ALL pending follow-ups (no date filter)
    const { data: followUpsData, error } = await supabase
      .from('follow_ups')
      .select(`
        id, lead_id, tipo, data_referencia, data_prevista, status, concluido_por, concluido_em,
        leads (id, nome, telefone, email, status_funil, is_matriculado)
      `)
      .eq('unidade_id', unidadeAtual.id)
      .eq('status', 'pendente')
      .order('data_prevista', { ascending: true });

    if (error) {
      console.error('Erro ao buscar follow-ups automáticos:', error);
      return;
    }

    // Collect valid follow-ups with SECURITY FILTER: is_matriculado has maximum priority
    const validFollowUps = followUpsData?.filter((item: any) => {
      if (!item.leads) return false;
      // REGRA DE SEGURANÇA: is_matriculado tem prioridade máxima
      if (item.leads.is_matriculado === true) return false;
      if (['perdido', 'convertido'].includes(item.leads.status_funil)) return false;
      return true;
    }) || [];

    const leadIds = validFollowUps.map((item: any) => item.lead_id);

    // Fetch last interaction for each lead
    let ultimaInteracaoMap: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: interacoesData } = await supabase
        .from('interacoes')
        .select('lead_id, data_interacao')
        .in('lead_id', leadIds)
        .order('data_interacao', { ascending: false });

      interacoesData?.forEach((i: any) => {
        if (!ultimaInteracaoMap[i.lead_id]) {
          ultimaInteracaoMap[i.lead_id] = i.data_interacao;
        }
      });
    }

    const items: FollowUpAutoItem[] = validFollowUps.map((item: any) => ({
      id: item.id,
      lead_id: item.lead_id,
      tipo: item.tipo,
      data_referencia: item.data_referencia,
      data_prevista: item.data_prevista,
      status: item.status,
      concluido_por: item.concluido_por,
      concluido_em: item.concluido_em,
      lead: {
        id: item.leads.id,
        nome: item.leads.nome,
        telefone: item.leads.telefone,
        email: item.leads.email,
        status_funil: item.leads.status_funil,
      },
      ultima_interacao: ultimaInteracaoMap[item.lead_id] || null,
    }));

    setAutoFollowUpItems(items);
  }, [unidadeAtual]);

  return {
    followUpItems,
    autoFollowUpItems,
    urgentAutoFollowUpItems,
    upcomingAutoFollowUpItems,
    loading,
    lastSyncTime,
    fetchFollowUp,
    fetchAutoFollowUps,
    generateFollowUps,
  };
}

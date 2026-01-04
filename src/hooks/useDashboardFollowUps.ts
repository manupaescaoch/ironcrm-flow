import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { EventoItem } from '@/components/dashboard/EventosHoje';
import { FollowUpAutoItem } from '@/components/dashboard/AutoFollowUpCard';
import { mapToLead, mapToInteracao } from '@/utils/dashboardMappers';

interface UseDashboardFollowUpsReturn {
  followUpItems: EventoItem[];
  autoFollowUpItems: FollowUpAutoItem[];
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

  // Internal fetch function for realtime updates
  const fetchAutoFollowUpsInternal = useCallback(async () => {
    if (!unidadeAtual) return;
    
    const { data: followUpsData, error } = await supabase
      .from('follow_ups')
      .select(`
        id, lead_id, tipo, data_referencia, data_prevista, status, concluido_por, concluido_em,
        leads (id, nome, telefone, email, status_funil)
      `)
      .eq('unidade_id', unidadeAtual.id)
      .eq('status', 'pendente')
      .order('data_prevista', { ascending: true });

    if (error) {
      console.error('Erro ao buscar follow-ups automáticos (realtime):', error);
      return;
    }

    const items: FollowUpAutoItem[] = [];
    followUpsData?.forEach((item: any) => {
      if (!item.leads) return;
      if (['perdido', 'convertido'].includes(item.leads.status_funil)) return;
      
      items.push({
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
      });
    });

    setAutoFollowUpItems(items);
    setLastSyncTime(new Date());
  }, [unidadeAtual]);

  // Realtime subscription for follow_ups table
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [unidadeAtual?.id, fetchAutoFollowUpsInternal]);

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
            motivo_perda, data_perda
          )
        `)
        .eq('compareceu', true)
        .eq('unidade_id', unidadeAtual.id)
        .not('fechou_matricula', 'eq', true);

      const items: EventoItem[] = [];
      followUpData?.forEach((interacaoData: any) => {
        if (!interacaoData.leads || interacaoData.leads.ativo === false) return;
        if (['convertido', 'perdido'].includes(interacaoData.leads.status_funil)) return;
        
        const lead = mapToLead(interacaoData.leads);
        const interacao = mapToInteracao(interacaoData);
        items.push({ lead, interacao, tipoEvento: 'experimental' });
      });

      // Check if any of these leads have closed matricula in other interacoes
      const leadIds = items.map(i => i.lead.id);
      if (leadIds.length > 0) {
        const { data: matriculasData } = await supabase
          .from('interacoes')
          .select('lead_id')
          .in('lead_id', leadIds)
          .eq('fechou_matricula', true);
        
        const closedLeadIds = new Set(matriculasData?.map((m: any) => m.lead_id) || []);
        const filteredItems = items.filter(i => !closedLeadIds.has(i.lead.id));
        setFollowUpItems(filteredItems);
      } else {
        setFollowUpItems(items);
      }
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

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

  // Fetch only - does NOT call generate-follow-ups
  const fetchAutoFollowUps = useCallback(async () => {
    if (!unidadeAtual) return;
    
    // Fetch pending follow-ups
    const { data: followUpsData, error } = await supabase
      .from('follow_ups')
      .select(`
        id, lead_id, tipo, data_referencia, data_prevista, status, concluido_por, concluido_em,
        leads (id, nome, telefone, email, status_funil)
      `)
      .eq('unidade_id', unidadeAtual.id)
      .eq('status', 'pendente')
      .order('data_prevista', { ascending: true });

    if (error) {
      console.error('Erro ao buscar follow-ups automáticos:', error);
      return;
    }

    const items: FollowUpAutoItem[] = [];
    followUpsData?.forEach((item: any) => {
      if (!item.leads) return;
      if (['perdido', 'convertido'].includes(item.leads.status_funil)) return;
      
      items.push({
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
      });
    });

    setAutoFollowUpItems(items);
  }, [unidadeAtual]);

  return {
    followUpItems,
    autoFollowUpItems,
    loading,
    lastSyncTime,
    fetchFollowUp,
    fetchAutoFollowUps,
    generateFollowUps,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { taskFuItem, type FuTaskItem } from '@/lib/fuTaskState';
import type { Task } from './useTarefasData';

export function usePersistedFuTasks() {
  const { unidadeAtual } = useUnidade();
  const unitId = unidadeAtual?.id;
  const current = useRef(unitId); current.current = unitId;
  const generation = useRef(0);
  const [state, setState] = useState<{ unitId?: string; items: FuTaskItem[]; loading: boolean; error: string | null }>({ items: [], loading: true, error: null });
  const refetch = useCallback(async () => {
    const request = ++generation.current;
    if (!unitId) { setState({ items: [], loading: false, error: null }); return; }
    setState(previous => ({ unitId, items: previous.unitId === unitId ? previous.items : [], loading: true, error: null }));
    try {
      const result = await supabase.from('tasks').select('*').eq('unidade_id', unitId).or('fu_matriculados_lead_id.not.is.null,fu_gerencial_etapa.not.is.null,fu_tecnico_etapa.not.is.null').order('prazo');
      if (result.error) throw result.error;
      const tasks = (result.data ?? []) as unknown as Task[];
      const items = tasks.map(taskFuItem).filter((item): item is FuTaskItem => item !== null);
      const ids = [...new Set(items.map(item => item.leadId))];
      const leads = new Map<string, { nome: string; telefone: string | null }>();
      for (let offset = 0; offset < ids.length; offset += 100) {
        const response = await supabase.from('leads').select('id,nome,telefone').eq('unidade_id', unitId).in('id', ids.slice(offset, offset + 100));
        if (response.error) throw response.error;
        for (const lead of response.data ?? []) leads.set(lead.id, lead);
      }
      if (request !== generation.current || current.current !== unitId) return;
      setState({ unitId, items: items.map(item => ({ ...item, lead: leads.get(item.leadId) ?? item.lead })), loading: false, error: null });
    } catch {
      if (request === generation.current && current.current === unitId) setState({ unitId, items: [], loading: false, error: 'Não foi possível carregar as confirmações de follow-up.' });
    }
  }, [unitId]);
  useEffect(() => {
    void refetch();
    if (!unitId) return;
    const channel = supabase.channel(`persisted-fu-${unitId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `unidade_id=eq.${unitId}` }, () => { void refetch(); }).subscribe();
    const refresh = () => { void refetch(); };
    window.addEventListener('focus', refresh);
    return () => { generation.current++; void supabase.removeChannel(channel); window.removeEventListener('focus', refresh); };
  }, [unitId, refetch]);
  return { items: state.unitId === unitId ? state.items : [], loading: state.unitId !== unitId || state.loading, error: state.unitId === unitId ? state.error : null, refetch };
}
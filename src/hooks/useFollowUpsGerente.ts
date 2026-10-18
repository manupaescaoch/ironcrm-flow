import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { fuDate, fuDay, addFuBusinessDays, diffFuBusinessDays, effectiveFuDay } from '@/lib/fuBusinessDays';

export type FollowUpGerenteTipo = 'G+7' | 'G+30';

export interface FollowUpGerenteItem {
  lead_id: string;
  tipo: FollowUpGerenteTipo;
  data_matricula: string; // ISO
  diasDesdeMatricula: number;
  data_prevista: string;
  lead: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
  };
}

/**
 * Régua do FU Gerente (dias desde a matrícula):
 *   0–6    → não aparece
 *   7–29   → G+7
 *   30–45  → G+30
 *   >45    → não aparece
 */
function calcularEtapa(dias: number): FollowUpGerenteTipo | null {
  if (dias < 7) return null;
  if (dias <= 29) return 'G+7';
  if (dias <= 45) return 'G+30';
  return null;
}

function diffDays(dataMatricula: Date, hoje: Date) {
  return diffFuBusinessDays(dataMatricula, hoje);
}

export function useFollowUpsGerente() {
  const { unidadeAtual } = useUnidade();
  const [items, setItems] = useState<FollowUpGerenteItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!unidadeAtual) return;
    setLoading(true);
    try {
      const { data: matriculas, error: errMat } = await supabase
        .from('interacoes')
        .select(`
          lead_id, data_fechamento,
          leads!inner (id, nome, telefone, email, is_matriculado, ativo)
        `)
        .eq('unidade_id', unidadeAtual.id)
        .eq('fechou_matricula', true)
        .not('data_fechamento', 'is', null)
        .order('data_fechamento', { ascending: false });

      if (errMat) {
        console.error('Erro ao buscar matriculados (FU gerente):', errMat);
        return;
      }

      const maisRecentePorLead = new Map<string, { data_fechamento: string; lead: any }>();
      (matriculas || []).forEach((row: any) => {
        const lead = row.leads;
        if (!lead || lead.is_matriculado !== true || lead.ativo === false) return;
        if (!maisRecentePorLead.has(row.lead_id)) {
          maisRecentePorLead.set(row.lead_id, { data_fechamento: row.data_fechamento, lead });
        }
      });

      const leadIds = Array.from(maisRecentePorLead.keys());
      if (leadIds.length === 0) {
        setItems([]);
        return;
      }

      const { data: fus, error: errFu } = await supabase
        .from('follow_ups')
        .select('lead_id, tipo, status, data_prevista')
        .eq('unidade_id', unidadeAtual.id)
        .in('lead_id', leadIds)
        .in('tipo', ['G+7', 'G+30']);

      if (errFu) {
        console.error('Erro ao buscar follow_ups gerente:', errFu);
      }

      const concluidos = new Set<string>();
      const reagendadoFuturo = new Set<string>();
      const hoje = fuDate(new Date());
      hoje.setHours(0, 0, 0, 0);

      (fus || []).forEach((f: any) => {
        const key = `${f.lead_id}|${f.tipo}`;
        if (f.status === 'concluido') {
          concluidos.add(key);
        } else if (f.status === 'pendente' && f.data_prevista) {
          if (fuDate(effectiveFuDay(f.data_prevista)) > hoje) reagendadoFuturo.add(key);
        }
      });

      const computados: FollowUpGerenteItem[] = [];
      for (const [leadId, info] of maisRecentePorLead) {
        const dias = diffDays(fuDate(info.data_fechamento), hoje);
        const etapa = calcularEtapa(dias);
        if (!etapa) continue;

        const key = `${leadId}|${etapa}`;
        if (concluidos.has(key) || reagendadoFuturo.has(key)) continue;
        const saved = (fus || []).find(f => f.lead_id === leadId && f.tipo === etapa && f.status === 'pendente');
        const due = saved?.data_prevista ? effectiveFuDay(saved.data_prevista) : fuDay(addFuBusinessDays(info.data_fechamento, Number(etapa.slice(2))));
        if (due > fuDay(hoje)) continue;

        computados.push({
          lead_id: leadId,
          tipo: etapa,
          data_matricula: info.data_fechamento,
          diasDesdeMatricula: dias,
          data_prevista: due,
          lead: {
            id: info.lead.id,
            nome: info.lead.nome,
            telefone: info.lead.telefone,
            email: info.lead.email,
          },
        });
      }

      setItems(computados);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!unidadeAtual) return;
    const channel = supabase
      .channel('follow_ups_gerente_realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'follow_ups',
        filter: `unidade_id=eq.${unidadeAtual.id}`,
      }, () => fetchItems())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'interacoes',
        filter: `unidade_id=eq.${unidadeAtual.id}`,
      }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unidadeAtual?.id, fetchItems]);

  const urgentItems = useMemo(() => items, [items]);

  return { items, urgentItems, loading, refetch: fetchItems };
}

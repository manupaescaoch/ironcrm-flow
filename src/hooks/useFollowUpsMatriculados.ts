import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';

export type FollowUpMatriculadoTipo = 'D+1' | 'D+7' | 'D+30';

export interface FollowUpMatriculadoItem {
  lead_id: string;
  tipo: FollowUpMatriculadoTipo;
  data_matricula: string; // ISO
  diasDesdeMatricula: number;
  lead: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
  };
}

/**
 * Régua dinâmica baseada em dias desde a matrícula:
 *   0–1   → D+1
 *   2–15  → D+7   (8–15 = D+7 atrasado)
 *   16–45 → D+30
 *   >45   → null (não exibe)
 */
function calcularEtapa(dias: number): FollowUpMatriculadoTipo | null {
  if (dias < 0) return null;
  if (dias <= 1) return 'D+1';
  if (dias <= 15) return 'D+7';
  if (dias <= 45) return 'D+30';
  return null;
}

function diffDays(dataMatricula: Date, hoje: Date) {
  const a = new Date(dataMatricula.getFullYear(), dataMatricula.getMonth(), dataMatricula.getDate());
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function useFollowUpsMatriculados() {
  const { unidadeAtual } = useUnidade();
  const [items, setItems] = useState<FollowUpMatriculadoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!unidadeAtual) return;
    setLoading(true);
    try {
      // 1) Buscar matrículas (interacoes.fechou_matricula = true) da unidade
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
        console.error('Erro ao buscar matriculados:', errMat);
        return;
      }

      // 2) Manter a matrícula mais recente por lead, filtrando ativos e is_matriculado
      const maisRecentePorLead = new Map<string, { data_fechamento: string; lead: any }>();
      (matriculas || []).forEach((row: any) => {
        const lead = row.leads;
        if (!lead || lead.is_matriculado !== true || lead.ativo === false) return;
        if (!maisRecentePorLead.has(row.lead_id)) {
          maisRecentePorLead.set(row.lead_id, {
            data_fechamento: row.data_fechamento,
            lead,
          });
        }
      });

      const leadIds = Array.from(maisRecentePorLead.keys());
      if (leadIds.length === 0) {
        setItems([]);
        return;
      }

      // 3) Buscar follow_ups D+ desses leads para excluir os já concluídos
      //    e respeitar reagendamentos (pendentes futuros)
      const { data: fus, error: errFu } = await supabase
        .from('follow_ups')
        .select('lead_id, tipo, status, data_prevista')
        .in('lead_id', leadIds)
        .in('tipo', ['D+1', 'D+7', 'D+30']);

      if (errFu) {
        console.error('Erro ao buscar follow_ups matriculados:', errFu);
      }

      const concluidos = new Set<string>(); // key = lead_id|tipo
      const reagendadoFuturo = new Map<string, Date>(); // key = lead_id|tipo => data
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      (fus || []).forEach((f: any) => {
        const key = `${f.lead_id}|${f.tipo}`;
        if (f.status === 'concluido') {
          concluidos.add(key);
        } else if (f.status === 'pendente' && f.data_prevista) {
          const dp = new Date(f.data_prevista);
          if (dp > hoje) {
            reagendadoFuturo.set(key, dp);
          }
        }
      });

      // 4) Calcular etapa por lead
      const computados: FollowUpMatriculadoItem[] = [];
      for (const [leadId, info] of maisRecentePorLead) {
        const dataMat = new Date(info.data_fechamento);
        const dias = diffDays(dataMat, new Date());
        const etapa = calcularEtapa(dias);
        if (!etapa) continue;

        const key = `${leadId}|${etapa}`;
        if (concluidos.has(key)) continue;
        if (reagendadoFuturo.has(key)) continue;

        computados.push({
          lead_id: leadId,
          tipo: etapa,
          data_matricula: info.data_fechamento,
          diasDesdeMatricula: dias,
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

  // Realtime: follow_ups + interacoes da unidade
  useEffect(() => {
    if (!unidadeAtual) return;
    const channel = supabase
      .channel('follow_ups_matriculados_realtime')
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

  // Urgent = vencidos ou hoje (mesma lógica usada antes)
  const urgentItems = useMemo(() => {
    // Toda etapa calculada já é "hoje ou vencida" — D+1 com 0 dia conta como hoje,
    // D+7 com 7 dias conta como hoje, etc. Itens com dias < etapa-target ficariam "futuros"
    // mas como filtramos apenas etapas atingidas, todos aqui são urgentes.
    return items;
  }, [items]);

  return { items, urgentItems, loading, refetch: fetchItems };
}

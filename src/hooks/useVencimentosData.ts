import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { addMonths, differenceInDays, parseISO, isValid, isToday } from 'date-fns';
import { formatDateLocal } from '@/lib/brasilia';

export type VencimentoStatus = 'vencido' | 'urgente' | 'atencao' | 'proximo' | 'ok' | 'inadimplente';

export interface VencimentoItem {
  id: string;
  leadId: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  planoEscolhido: string;
  dataFechamento: Date;
  dataVencimento: Date;
  diasRestantes: number;
  status: VencimentoStatus;
  unidadeId: string;
  pagamentoConfirmado: boolean;
}

export type VencimentoTipo = 'mensais' | 'fim_plano' | 'todos';

export interface VencimentosFilters {
  status: VencimentoStatus | 'todos' | 'hoje';
  plano: string | 'todos';
  tipo: VencimentoTipo;
}

export interface VencimentosSummary {
  vencidos: number;
  urgentes: number;
  atencao: number;
  proximos: number;
  ok: number;
  total: number;
  vencendoHoje: number;
  inadimplentes: number;
}

const calcularVencimento = (plano: string, dataFechamento: Date): Date | null => {
  if (!plano || !dataFechamento || !isValid(dataFechamento)) return null;

  const planoNormalizado = plano.toLowerCase().trim();

  if (planoNormalizado.includes('mensal')) {
    return addMonths(dataFechamento, 1);
  }
  if (planoNormalizado.includes('trimestral')) {
    return addMonths(dataFechamento, 3);
  }
  if (planoNormalizado.includes('semestral')) {
    return addMonths(dataFechamento, 6);
  }
  if (planoNormalizado.includes('anual')) {
    return addMonths(dataFechamento, 12);
  }

  return null;
};

const getVencimentoStatus = (diasRestantes: number): VencimentoStatus => {
  if (diasRestantes < 0) return 'vencido';
  if (diasRestantes <= 7) return 'urgente';
  if (diasRestantes <= 15) return 'atencao';
  if (diasRestantes <= 30) return 'proximo';
  return 'ok';
};

const isMensal = (plano: string) => plano.toLowerCase().includes('mensal');

export function useVencimentosData(filters: VencimentosFilters = { status: 'todos', plano: 'todos', tipo: 'mensais' }) {
  const { unidadeAtual } = useUnidade();

  // Buscar pagamentos confirmados
  const { data: pagamentosData } = useQuery({
    queryKey: ['pagamentos-mensais', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data, error } = await supabase
        .from('pagamentos_mensais')
        .select('interacao_id, data_vencimento')
        .eq('unidade_id', unidadeAtual.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!unidadeAtual?.id,
  });

  // Set de pagamentos confirmados para verificação rápida
  const pagamentosConfirmadosSet = useMemo(() => {
    return new Set(
      (pagamentosData || []).map((p) => `${p.interacao_id}_${p.data_vencimento}`)
    );
  }, [pagamentosData]);

  const { data: rawData, isLoading, error, refetch } = useQuery({
    queryKey: ['vencimentos', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];

      // Buscar matrículas com data de fechamento
      const { data, error } = await supabase
        .from('interacoes')
        .select(`
          id,
          lead_id,
          plano_escolhido,
          data_fechamento,
          data_vencimento,
          unidade_id,
          leads!inner (
            id,
            nome,
            telefone,
            email,
            is_matriculado,
            ativo
          )
        `)
        .eq('fechou_matricula', true)
        .eq('unidade_id', unidadeAtual.id)
        .not('data_fechamento', 'is', null)
        .not('plano_escolhido', 'is', null);

      if (error) throw error;
      return data || [];
    },
    enabled: !!unidadeAtual?.id,
  });

  const vencimentos = useMemo<VencimentoItem[]>(() => {
    if (!rawData) return [];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return rawData
      .map((item): VencimentoItem | null => {
        const lead = item.leads as any;
        if (!lead || !lead.ativo || !lead.is_matriculado) return null;

        const dataFechamento = parseISO(item.data_fechamento!);
        
        // Usar data_vencimento se disponível, senão calcular baseado no plano
        const dataVencimento = item.data_vencimento 
          ? parseISO(item.data_vencimento)
          : calcularVencimento(item.plano_escolhido!, dataFechamento);

        if (!dataVencimento) return null;

        const diasRestantes = differenceInDays(dataVencimento, hoje);
        
        // Verificar se pagamento foi confirmado para este ciclo
        const dataVencimentoStr = formatDateLocal(dataVencimento);
        const pagamentoConfirmado = pagamentosConfirmadosSet.has(`${item.id}_${dataVencimentoStr}`);
        
        // Determinar status: se vencido e não pago = inadimplente
        let status = getVencimentoStatus(diasRestantes);
        if (status === 'vencido' && !pagamentoConfirmado) {
          status = 'inadimplente';
        }

        return {
          id: item.id,
          leadId: lead.id,
          nome: lead.nome,
          telefone: lead.telefone,
          email: lead.email,
          planoEscolhido: item.plano_escolhido!,
          dataFechamento,
          dataVencimento,
          diasRestantes,
          status,
          unidadeId: item.unidade_id,
          pagamentoConfirmado,
        };
      })
      .filter((item): item is VencimentoItem => item !== null)
      .sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [rawData, pagamentosConfirmadosSet]);

  const filteredVencimentos = useMemo(() => {
    return vencimentos.filter((item) => {
      // Filtro por tipo de plano
      if (filters.tipo === 'mensais') {
        if (!isMensal(item.planoEscolhido)) return false;
      } else if (filters.tipo === 'fim_plano') {
        if (isMensal(item.planoEscolhido)) return false;
        if (item.diasRestantes > 30) return false;
      }
      // Filtro especial para "hoje"
      if (filters.status === 'hoje') {
        return isToday(item.dataVencimento);
      }
      // Filtro para inadimplentes (inclui vencidos sem pagamento)
      if (filters.status === 'inadimplente') {
        return item.status === 'inadimplente';
      }
      if (filters.status !== 'todos' && item.status !== filters.status) {
        return false;
      }
      if (filters.plano !== 'todos' && item.planoEscolhido !== filters.plano) {
        return false;
      }
      return true;
    });
  }, [vencimentos, filters]);

  const summary = useMemo<VencimentosSummary>(() => {
    const hoje = new Date();
    return vencimentos.reduce(
      (acc, item) => {
        acc.total++;
        // Contar vencendo hoje
        if (isToday(item.dataVencimento)) {
          acc.vencendoHoje++;
        }
        // Contar inadimplentes
        if (item.status === 'inadimplente') {
          acc.inadimplentes++;
        }
        // Contagem por status
        if (item.status === 'proximo') acc.proximos++;
        else if (item.status === 'atencao') acc.atencao++;
        else if (item.status === 'urgente') acc.urgentes++;
        else if (item.status === 'vencido' || item.status === 'inadimplente') acc.vencidos++;
        else acc.ok++;
        return acc;
      },
      { vencidos: 0, urgentes: 0, atencao: 0, proximos: 0, ok: 0, total: 0, vencendoHoje: 0, inadimplentes: 0 }
    );
  }, [vencimentos]);

  const planosDisponiveis = useMemo(() => {
    const planos = new Set(vencimentos.map((v) => v.planoEscolhido));
    return Array.from(planos).sort();
  }, [vencimentos]);

  return {
    vencimentos: filteredVencimentos,
    allVencimentos: vencimentos,
    summary,
    planosDisponiveis,
    isLoading,
    error,
    refetch,
  };
}

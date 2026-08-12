import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PremissaRow {
  id: string;
  unidade_id: string;
  ano: number;
  mes: number;
  investimento_previsto: number;
  custo_por_conversa: number | null;
  taxa_conversa_lead: number;
  taxa_lead_agendamento: number;
  taxa_agendamento_comparecimento: number;
  taxa_comparecimento_matricula: number;
  churn_mensal: number;
  ticket_medio: number | null;
  capacidade_maxima: number | null;
  observacoes: string | null;
}

export interface RealizadoRow {
  id: string;
  unidade_id: string;
  ano: number;
  mes: number;
  conversas_iniciadas: number | null;
  investimento_real: number | null;
  base_inicial: number | null;
  base_final: number | null;
  cancelamentos: number | null;
}

export interface MetaRow {
  id: string;
  unidade_id: string;
  ano: number;
  mes: number;
  meta_alunos_ativos: number | null;
  meta_matriculas: number | null;
  cac_maximo: number | null;
}

export interface RealizadoAuto {
  mes: number;
  leads: number;
  agendamentos: number;
  comparecimentos: number;
  matriculas: number;
  investimento: number | null;
  ticketMedio: number | null;
}

const anyClient = supabase as any;

/** Premissas, realizado manual e metas do ano/unidade. */
export function useForecastConfig(unidadeId: string | undefined, ano: number) {
  const premissas = useQuery({
    queryKey: ['forecast-premissas', unidadeId, ano],
    enabled: !!unidadeId,
    queryFn: async (): Promise<PremissaRow[]> => {
      const { data, error } = await anyClient
        .from('forecast_premissas')
        .select('*')
        .eq('unidade_id', unidadeId)
        .eq('ano', ano)
        .order('mes');
      if (error) throw error;
      return (data ?? []) as PremissaRow[];
    },
  });

  const realizado = useQuery({
    queryKey: ['forecast-realizado', unidadeId, ano],
    enabled: !!unidadeId,
    queryFn: async (): Promise<RealizadoRow[]> => {
      const { data, error } = await anyClient
        .from('forecast_realizado')
        .select('*')
        .eq('unidade_id', unidadeId)
        .eq('ano', ano)
        .order('mes');
      if (error) throw error;
      return (data ?? []) as RealizadoRow[];
    },
  });

  const metas = useQuery({
    queryKey: ['forecast-metas', unidadeId, ano],
    enabled: !!unidadeId,
    queryFn: async (): Promise<MetaRow[]> => {
      const { data, error } = await anyClient
        .from('forecast_metas')
        .select('*')
        .eq('unidade_id', unidadeId)
        .eq('ano', ano)
        .order('mes');
      if (error) throw error;
      return (data ?? []) as MetaRow[];
    },
  });

  return { premissas, realizado, metas };
}

/** Dados realizados extraídos automaticamente do CRM (por mês do ano informado). */
export function useForecastRealizadoAuto(unidadeId: string | undefined, ano: number) {
  return useQuery({
    queryKey: ['forecast-realizado-auto', unidadeId, ano],
    enabled: !!unidadeId,
    queryFn: async (): Promise<RealizadoAuto[]> => {
      const inicio = `${ano}-01-01`;
      const fim = `${ano}-12-31`;

      const [leadsRes, interRes, investRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, created_at')
          .eq('unidade_id', unidadeId)
          .gte('created_at', `${inicio}T00:00:00`)
          .lte('created_at', `${fim}T23:59:59`),
        supabase
          .from('interacoes')
          .select('data_interacao, data_experimental, data_fechamento, agendou_experimental, compareceu, fechou_matricula, valor_plano')
          .eq('unidade_id', unidadeId)
          .gte('data_interacao', inicio)
          .lte('data_interacao', fim),
        anyClient
          .from('investimentos_marketing')
          .select('data_inicio, valor')
          .eq('unidade_id', unidadeId)
          .gte('data_inicio', inicio)
          .lte('data_inicio', fim),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (interRes.error) throw interRes.error;

      const base: RealizadoAuto[] = Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        leads: 0,
        agendamentos: 0,
        comparecimentos: 0,
        matriculas: 0,
        investimento: null,
        ticketMedio: null,
      }));

      const mesDe = (iso?: string | null) => {
        if (!iso) return null;
        const m = Number(String(iso).slice(5, 7));
        return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null;
      };

      (leadsRes.data ?? []).forEach((l: any) => {
        const m = mesDe(l.created_at);
        if (m) base[m - 1].leads += 1;
      });

      const somaPlano: number[] = Array(12).fill(0);

      (interRes.data ?? []).forEach((i: any) => {
        const mInter = mesDe(i.data_interacao);
        if (i.agendou_experimental && mInter) base[mInter - 1].agendamentos += 1;
        const mExp = mesDe(i.data_experimental) ?? mInter;
        if (i.compareceu && mExp) base[mExp - 1].comparecimentos += 1;
        const mFech = mesDe(i.data_fechamento) ?? mInter;
        if (i.fechou_matricula && mFech) {
          base[mFech - 1].matriculas += 1;
          somaPlano[mFech - 1] += Number(i.valor_plano ?? 0);
        }
      });

      base.forEach((row, idx) => {
        if (row.matriculas > 0 && somaPlano[idx] > 0) {
          row.ticketMedio = Math.round((somaPlano[idx] / row.matriculas) * 100) / 100;
        }
      });

      if (!investRes.error) {
        (investRes.data ?? []).forEach((inv: any) => {
          const m = mesDe(inv.data_inicio);
          if (m) base[m - 1].investimento = (base[m - 1].investimento ?? 0) + Number(inv.valor ?? 0);
        });
      }

      return base;
    },
  });
}

/** Capacidade e base de alunos ativos cadastrados em Gestão de Metas. */
export function useForecastBaseAtual(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['forecast-base-atual', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await anyClient
        .from('gestao_metas')
        .select('capacidade_alunos, alunos_ativos_manual, ticket_medio_real, meta_alunos_mes')
        .eq('unidade_id', unidadeId)
        .maybeSingle();
      if (error) throw error;
      return {
        capacidade: (data?.capacidade_alunos as number | null) ?? null,
        alunosAtivos: (data?.alunos_ativos_manual as number | null) ?? null,
        ticketMedio: (data?.ticket_medio_real as number | null) ?? null,
        metaAlunos: (data?.meta_alunos_mes as number | null) ?? null,
      };
    },
  });
}

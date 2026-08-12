import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { mesAnterior, num, safeDiv, toISODate } from '@/lib/forecast';

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
  leads_crm: number | null;
  experimentais_marcadas: number | null;
  comparecimentos: number | null;
  matriculas_total: number | null;
  matriculas_trafego: number | null;
  ticket_medio: number | null;
  alunos_ativos: number | null;
  fechado: boolean;
  fechado_em: string | null;
  observacoes: string | null;
}

export interface PremissasRow {
  id?: string;
  unidade_id: string;
  ano: number;
  mes: number;
  investimento_previsto: number;
  cpl_projetado: number | null;
  taxa_lead_agendamento: number;
  taxa_agendamento_comparecimento: number;
  taxa_comparecimento_matricula: number;
  taxa_conversa_lead: number;
  aproveitamento_atendimento: number | null;
  churn_mensal: number;
  mensalidade_media: number | null;
  ticket_medio: number | null;
  base_inicial: number | null;
  capacidade_maxima: number | null;
  meta_alunos: number | null;
}

export interface SemanalRow {
  id?: string;
  unidade_id: string;
  semana_inicio: string;
  alunos_segunda: number;
  matriculas: number;
  cancelamentos: number;
  alunos_sexta: number | null;
}

export interface AutoMes {
  leads: number;
  experimentais: number;
  comparecimentos: number;
  matriculas: number;
  matriculasTrafego: number;
  ticketMedio: number;
  investimento: number;
}

const inicioMes = (ano: number, mes: number) => new Date(ano, mes - 1, 1);
const inicioProximoMes = (ano: number, mes: number) => new Date(ano, mes, 1);

/** Métricas automáticas vindas do CRM para um mês/unidade. */
async function fetchAutoMes(unidadeId: string, ano: number, mes: number): Promise<AutoMes> {
  const ini = toISODate(inicioMes(ano, mes));
  const fim = toISODate(inicioProximoMes(ano, mes));

  const [leadsRes, expRes, matRes, invRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidadeId)
      .gte('created_at', `${ini}T00:00:00`)
      .lt('created_at', `${fim}T00:00:00`),
    supabase
      .from('interacoes')
      .select('compareceu, data_experimental')
      .eq('unidade_id', unidadeId)
      .eq('agendou_experimental', true)
      .gte('data_experimental', ini)
      .lt('data_experimental', fim),
    supabase
      .from('interacoes')
      .select('valor_plano, origem_fechamento, leads!interacoes_lead_id_fkey(origem)')
      .eq('unidade_id', unidadeId)
      .eq('fechou_matricula', true)
      .gte('data_fechamento', ini)
      .lt('data_fechamento', fim),
    supabase
      .from('investimentos_marketing')
      .select('valor')
      .eq('unidade_id', unidadeId)
      .lt('data_inicio', fim)
      .gte('data_fim', ini),
  ]);

  const exp = expRes.data ?? [];
  const mats = (matRes.data ?? []) as Array<{
    valor_plano: number | null;
    leads: { origem: string | null } | null;
  }>;
  const valores = mats.map((m) => num(m.valor_plano)).filter((v) => v > 0);
  const trafego = mats.filter((m) => {
    const o = (m.leads?.origem ?? '').toUpperCase();
    return o.includes('TRÁFEGO') || o.includes('TRAFEGO') || o.includes('INSTAGRAM');
  }).length;

  return {
    leads: leadsRes.count ?? 0,
    experimentais: exp.length,
    comparecimentos: exp.filter((e) => e.compareceu === true).length,
    matriculas: mats.length,
    matriculasTrafego: trafego,
    ticketMedio: valores.length ? safeDiv(valores.reduce((a, b) => a + b, 0), valores.length) : 0,
    investimento: (invRes.data ?? []).reduce((a, r) => a + num(r.valor), 0),
  };
}

export function useForecastData(unidadeId: string | null, mes: number, ano: number) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const anterior = useMemo(() => mesAnterior(mes, ano), [mes, ano]);

  const realizados = useQuery({
    queryKey: ['forecast-realizado', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_realizado')
        .select('*')
        .eq('unidade_id', unidadeId!)
        .order('ano', { ascending: true })
        .order('mes', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RealizadoRow[];
    },
  });

  const premissas = useQuery({
    queryKey: ['forecast-premissas', unidadeId, ano, mes],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_premissas')
        .select('*')
        .eq('unidade_id', unidadeId!)
        .eq('ano', ano)
        .eq('mes', mes)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as PremissasRow | null;
    },
  });

  const semanal = useQuery({
    queryKey: ['forecast-semanal', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forecast_semanal')
        .select('*')
        .eq('unidade_id', unidadeId!)
        .order('semana_inicio', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SemanalRow[];
    },
  });

  // Auto do mês anterior (referência do "Real do último mês")
  const autoAnterior = useQuery({
    queryKey: ['forecast-auto', unidadeId, anterior.ano, anterior.mes],
    enabled: !!unidadeId,
    queryFn: () => fetchAutoMes(unidadeId!, anterior.ano, anterior.mes),
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['forecast-realizado', unidadeId] });
    qc.invalidateQueries({ queryKey: ['forecast-premissas', unidadeId] });
    qc.invalidateQueries({ queryKey: ['forecast-semanal', unidadeId] });
    qc.invalidateQueries({ queryKey: ['forecast-auto', unidadeId] });
  }, [qc, unidadeId]);

  const salvarPremissas = useMutation({
    mutationFn: async (p: Partial<PremissasRow>) => {
      if (!unidadeId) throw new Error('Selecione uma unidade');
      const payload = { ...p, unidade_id: unidadeId, ano, mes, created_by: user?.id ?? null };
      const { error } = await supabase
        .from('forecast_premissas')
        .upsert(payload as never, { onConflict: 'unidade_id,ano,mes' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Premissas salvas' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar premissas', description: e.message, variant: 'destructive' }),
  });

  const salvarRealizado = useMutation({
    mutationFn: async (payload: Partial<RealizadoRow> & { ano: number; mes: number }) => {
      if (!unidadeId) throw new Error('Selecione uma unidade');
      const { error } = await supabase
        .from('forecast_realizado')
        .upsert({ ...payload, unidade_id: unidadeId, created_by: user?.id ?? null } as never, {
          onConflict: 'unidade_id,ano,mes',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Dados do mês salvos' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const fecharMes = useMutation({
    mutationFn: async (payload: Partial<RealizadoRow> & { ano: number; mes: number }) => {
      if (!unidadeId) throw new Error('Selecione uma unidade');
      const { error } = await supabase
        .from('forecast_realizado')
        .upsert(
          {
            ...payload,
            unidade_id: unidadeId,
            fechado: true,
            fechado_em: new Date().toISOString(),
            fechado_por: user?.id ?? null,
            created_by: user?.id ?? null,
          } as never,
          { onConflict: 'unidade_id,ano,mes' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Mês fechado', description: 'O fechamento virou a base inicial do mês seguinte.' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro ao fechar o mês', description: e.message, variant: 'destructive' }),
  });

  const reabrirMes = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from('forecast_realizado')
        .update({ fechado: false, fechado_em: null } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Mês reaberto' });
      invalidate();
    },
    onError: (e: Error) => toast({ title: 'Erro ao reabrir', description: e.message, variant: 'destructive' }),
  });

  const salvarSemana = useMutation({
    mutationFn: async (row: Omit<SemanalRow, 'unidade_id'>) => {
      if (!unidadeId) throw new Error('Selecione uma unidade');
      const { error } = await supabase
        .from('forecast_semanal')
        .upsert({ ...row, unidade_id: unidadeId, created_by: user?.id ?? null } as never, {
          onConflict: 'unidade_id,semana_inicio',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Semana salva' });
      qc.invalidateQueries({ queryKey: ['forecast-semanal', unidadeId] });
    },
    onError: (e: Error) => toast({ title: 'Erro ao salvar semana', description: e.message, variant: 'destructive' }),
  });

  return {
    realizados: realizados.data ?? [],
    premissasRow: premissas.data ?? null,
    semanalRows: semanal.data ?? [],
    autoAnterior: autoAnterior.data ?? null,
    mesAnteriorRef: anterior,
    loading: realizados.isLoading || premissas.isLoading || autoAnterior.isLoading,
    refetchAll: invalidate,
    salvarPremissas,
    salvarRealizado,
    fecharMes,
    reabrirMes,
    salvarSemana,
  };
}

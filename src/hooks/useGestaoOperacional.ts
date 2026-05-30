import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, format } from 'date-fns';

export interface MetaUnidade {
  id: string;
  unidade_id: string;
  capacidade_alunos: number;
  meta_ocupacao_pct: number;
  meta_matriculas_semana: number;
  meta_receita_mes: number;
  meta_taxa_comparecimento_pct: number;
  meta_taxa_conversao_pct: number;
}

export interface UnidadeKPIs {
  unidade_id: string;
  unidade_nome: string;
  meta: MetaUnidade | null;
  alunos_ativos: number;
  matriculas_semana: number;
  matriculas_semana_anterior: number;
  cancelamentos_semana: number;
  cancelamentos_semana_anterior: number;
  comparecimentos_semana: number;
  experimentais_semana: number;
  taxa_comparecimento: number;
  taxa_comparecimento_anterior: number;
  taxa_conversao: number;
  taxa_conversao_anterior: number;
  follow_ups_pendentes: number;
  follow_ups_atrasados_24h: number;
  receita_mes: number;
  receita_mes_anterior: number;
  ocupacao_pct: number;
  alertas: string[];
}

export interface SeriesPoint {
  semana: string;
  matriculas: number;
  cancelamentos: number;
  ocupacao: number;
}

const monday = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
const sunday = (d: Date) => endOfWeek(d, { weekStartsOn: 1 });

async function fetchUnidadeKPIs(unidade_id: string, unidade_nome: string, meta: MetaUnidade | null): Promise<UnidadeKPIs> {
  const now = new Date();
  const wkStart = monday(now);
  const wkEnd = sunday(now);
  const prevStart = monday(subWeeks(now, 1));
  const prevEnd = sunday(subWeeks(now, 1));
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subWeeks(now, 4));
  const prevMonthEnd = endOfMonth(subWeeks(now, 4));

  const iso = (d: Date) => d.toISOString();
  const dateOnly = (d: Date) => format(d, 'yyyy-MM-dd');

  // Alunos ativos = leads matriculados ativos
  const { count: alunosAtivos } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidade_id)
    .eq('is_matriculado', true)
    .eq('ativo', true);

  // Matrículas (semana atual e anterior) — usar data_fechamento
  const { data: matrSem } = await supabase
    .from('interacoes')
    .select('id, valor_plano, data_fechamento')
    .eq('unidade_id', unidade_id)
    .eq('fechou_matricula', true)
    .gte('data_fechamento', dateOnly(wkStart))
    .lte('data_fechamento', dateOnly(wkEnd));
  const { data: matrAnt } = await supabase
    .from('interacoes')
    .select('id')
    .eq('unidade_id', unidade_id)
    .eq('fechou_matricula', true)
    .gte('data_fechamento', dateOnly(prevStart))
    .lte('data_fechamento', dateOnly(prevEnd));

  // Cancelamentos: leads matriculados que foram inativados na semana
  const { count: cancSem } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidade_id)
    .eq('is_matriculado', true)
    .eq('ativo', false)
    .gte('updated_at', iso(wkStart))
    .lte('updated_at', iso(wkEnd));
  const { count: cancAnt } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidade_id)
    .eq('is_matriculado', true)
    .eq('ativo', false)
    .gte('updated_at', iso(prevStart))
    .lte('updated_at', iso(prevEnd));

  // Experimentais agendadas e comparecimentos da semana
  const { data: expSem } = await supabase
    .from('interacoes')
    .select('id, compareceu, data_experimental')
    .eq('unidade_id', unidade_id)
    .eq('agendou_experimental', true)
    .gte('data_experimental', dateOnly(wkStart))
    .lte('data_experimental', dateOnly(wkEnd));
  const { data: expAnt } = await supabase
    .from('interacoes')
    .select('id, compareceu')
    .eq('unidade_id', unidade_id)
    .eq('agendou_experimental', true)
    .gte('data_experimental', dateOnly(prevStart))
    .lte('data_experimental', dateOnly(prevEnd));

  const experimentais = (expSem ?? []).length;
  const comparecimentos = (expSem ?? []).filter(e => e.compareceu === true).length;
  const taxaComp = experimentais > 0 ? Math.round((comparecimentos / experimentais) * 100) : 0;
  const expAntTotal = (expAnt ?? []).length;
  const compAnt = (expAnt ?? []).filter(e => e.compareceu === true).length;
  const taxaCompAnt = expAntTotal > 0 ? Math.round((compAnt / expAntTotal) * 100) : 0;

  const matriculas = (matrSem ?? []).length;
  const matriculasAnt = (matrAnt ?? []).length;
  const taxaConv = comparecimentos > 0 ? Math.round((matriculas / comparecimentos) * 100) : 0;
  const taxaConvAnt = compAnt > 0 ? Math.round((matriculasAnt / compAnt) * 100) : 0;

  // Follow-ups pendentes (total e atrasados 24h)
  const { count: fuPend } = await supabase
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidade_id)
    .eq('status', 'pendente');
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const { count: fuAtrasados } = await supabase
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('unidade_id', unidade_id)
    .eq('status', 'pendente')
    .lte('data_prevista', dateOnly(yesterday));

  // Receita do mês (sum valor_plano de matrículas fechadas no mês)
  const { data: receitaRows } = await supabase
    .from('interacoes')
    .select('valor_plano, data_fechamento')
    .eq('unidade_id', unidade_id)
    .eq('fechou_matricula', true)
    .gte('data_fechamento', dateOnly(monthStart))
    .lte('data_fechamento', dateOnly(monthEnd));
  const receita = (receitaRows ?? []).reduce((s, r: any) => s + Number(r.valor_plano || 0), 0);

  const { data: receitaAntRows } = await supabase
    .from('interacoes')
    .select('valor_plano')
    .eq('unidade_id', unidade_id)
    .eq('fechou_matricula', true)
    .gte('data_fechamento', dateOnly(prevMonthStart))
    .lte('data_fechamento', dateOnly(prevMonthEnd));
  const receitaAnt = (receitaAntRows ?? []).reduce((s, r: any) => s + Number(r.valor_plano || 0), 0);

  const capacidade = meta?.capacidade_alunos ?? 0;
  const ocupacaoPct = capacidade > 0 ? Math.round(((alunosAtivos ?? 0) / capacidade) * 100) : 0;

  // Alertas
  const alertas: string[] = [];
  const metaOcup = meta?.meta_ocupacao_pct ?? 80;
  if (taxaComp < 75 && experimentais > 0) alertas.push(`Taxa de comparecimento (${taxaComp}%) abaixo de 75%`);
  if ((fuAtrasados ?? 0) > 0) alertas.push(`${fuAtrasados} follow-up(s) pendente(s) há mais de 24h`);
  if ((cancSem ?? 0) > matriculas) alertas.push(`Cancelamentos da semana (${cancSem}) superam as matrículas (${matriculas})`);
  if (capacidade > 0 && ocupacaoPct < metaOcup * 0.8) alertas.push(`Ocupação (${ocupacaoPct}%) abaixo de 80% da meta (${metaOcup}%)`);

  return {
    unidade_id,
    unidade_nome,
    meta,
    alunos_ativos: alunosAtivos ?? 0,
    matriculas_semana: matriculas,
    matriculas_semana_anterior: matriculasAnt,
    cancelamentos_semana: cancSem ?? 0,
    cancelamentos_semana_anterior: cancAnt ?? 0,
    comparecimentos_semana: comparecimentos,
    experimentais_semana: experimentais,
    taxa_comparecimento: taxaComp,
    taxa_comparecimento_anterior: taxaCompAnt,
    taxa_conversao: taxaConv,
    taxa_conversao_anterior: taxaConvAnt,
    follow_ups_pendentes: fuPend ?? 0,
    follow_ups_atrasados_24h: fuAtrasados ?? 0,
    receita_mes: receita,
    receita_mes_anterior: receitaAnt,
    ocupacao_pct: ocupacaoPct,
    alertas,
  };
}

export function useGestaoOperacional() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<UnidadeKPIs[]>([]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: unidades } = await supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome');
      const { data: metas } = await supabase.from('gestao_metas').select('*');
      const metaMap = new Map((metas ?? []).map((m: any) => [m.unidade_id, m as MetaUnidade]));

      const results = await Promise.all(
        (unidades ?? []).map(u => fetchUnidadeKPIs(u.id, u.nome, metaMap.get(u.id) ?? null))
      );
      setKpis(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { loading, kpis, refetch: fetch };
}

export async function fetchUnidadeHistorico(unidade_id: string, capacidade: number, weeks = 8): Promise<SeriesPoint[]> {
  const points: SeriesPoint[] = [];
  const now = new Date();
  for (let i = weeks - 1; i >= 0; i--) {
    const ref = subWeeks(now, i);
    const start = monday(ref);
    const end = sunday(ref);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const { data: matr } = await supabase
      .from('interacoes')
      .select('id')
      .eq('unidade_id', unidade_id)
      .eq('fechou_matricula', true)
      .gte('data_fechamento', startStr)
      .lte('data_fechamento', endStr);

    const { count: canc } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidade_id)
      .eq('is_matriculado', true)
      .eq('ativo', false)
      .gte('updated_at', start.toISOString())
      .lte('updated_at', end.toISOString());

    // Ocupação aproximada: alunos ativos atuais (snapshot histórico não existe)
    const { count: ativos } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', unidade_id)
      .eq('is_matriculado', true)
      .eq('ativo', true)
      .lte('created_at', end.toISOString());

    points.push({
      semana: format(start, 'dd/MM'),
      matriculas: (matr ?? []).length,
      cancelamentos: canc ?? 0,
      ocupacao: capacidade > 0 ? Math.round(((ativos ?? 0) / capacidade) * 100) : 0,
    });
  }
  return points;
}

import { fetchAllRows } from '@/lib/fetchAllRows';
import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUnidade } from '@/contexts/UnidadeContext';
import { format } from 'date-fns';
import { 
  InteracaoComLead, 
  ComissaoAgrupada, 
  TreinadorBonus, 
  ComissaoStats, 
  TreinadorStats,
  CURRENT_YEAR 
} from '@/components/comissoes/constants';
import {
  normalizeCadastrador,
  deveExcluirResponsavel,
  isValidTreinador,
  padronizarTreinadorComissoes,
  calcularBonusPorAluno,
} from '@/utils/comissoesMappers';

export interface ExperimentalTreinador { lead_id: string; treinador_responsavel: string | null }

/** Matrículas atribuídas às experimentais do treinador ÷ experimentais realizadas (alunos únicos) × 100. */
export function calcularConversaoTreinador(aulas: Set<string>, matriculas: Set<string>): number {
  if (aulas.size === 0) return 0;
  let convertidas = 0;
  aulas.forEach((lead) => { if (matriculas.has(lead)) convertidas++; });
  return (convertidas / aulas.size) * 100;
}

export function useComissoesData() {
  const [loading, setLoading] = useState(false);
  const [interacoes, setInteracoes] = useState<InteracaoComLead[]>([]);
  const [mes, setMes] = useState<string>((new Date().getMonth() + 1).toString());
  const [ano, setAno] = useState<string>(CURRENT_YEAR.toString());
  const [filterFuncionario, setFilterFuncionario] = useState<string>('');
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();

  const [experimentais, setExperimentais] = useState<ExperimentalTreinador[]>([]);
  const requestIdRef = useRef(0);
  useEffect(() => () => { requestIdRef.current++; }, []);

  const fetchComissoes = async () => {
    if (!unidadeAtual) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);

    const mesNum = parseInt(mes);
    const anoNum = parseInt(ano);

    const startDate = new Date(anoNum, mesNum - 1, 1);
    const endDate = new Date(anoNum, mesNum, 0);

    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    const experimentaisPromise = fetchAllRows((from, to) => supabase
      .from('interacoes')
      .select('lead_id, treinador_responsavel', { count: 'exact' })
      .eq('compareceu', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_experimental', startDateStr)
      .lte('data_experimental', endDateStr)
      .order('id', { ascending: true }).range(from, to));

    const { data: interacoesData, error } = await fetchAllRows((from, to) => supabase
      .from('interacoes')
      .select('id, lead_id, responsavel_fechamento, treinador_responsavel, valor_plano, plano_escolhido, comissao_comercial, comissao_recepcao, data_fechamento, fechou_matricula, compareceu, leads(nome, cadastrado_por)', { count: 'exact' })
      .eq('fechou_matricula', true)
      .eq('unidade_id', unidadeAtual.id)
      .gte('data_fechamento', startDateStr)
      .lte('data_fechamento', endDateStr)
      .order('data_fechamento', { ascending: false })
        .order('id', { ascending: true }).range(from, to));

    const { data: experimentaisData, error: expError } = await experimentaisPromise;

    if (requestId !== requestIdRef.current) return;
    if (expError) {
      toast({ title: 'Consulta incompleta. Tente novamente.', variant: 'destructive' });
      setLoading(false);
      return;
    }
    setExperimentais(expError ? [] : (experimentaisData || []));

    if (error) {
      toast({ title: 'Erro ao carregar comissões', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const mappedData: InteracaoComLead[] = (interacoesData || []).map((int: any) => ({
      ...int,
      lead_nome: int.leads?.nome || 'Lead não encontrado',
      lead_cadastrado_por: int.leads?.cadastrado_por || null,
    }));

    setInteracoes(mappedData);
    setLoading(false);
  };

  useEffect(() => {
    if (mes && ano && unidadeAtual) {
      fetchComissoes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, ano, unidadeAtual?.id]);

  const filteredInteracoes = useMemo(() => {
    if (!filterFuncionario.trim()) return interacoes;
    const filter = filterFuncionario.toLowerCase();
    return interacoes.filter(
      (int) =>
        int.responsavel_fechamento?.toLowerCase().includes(filter) ||
        int.treinador_responsavel?.toLowerCase().includes(filter) ||
        int.lead_cadastrado_por?.toLowerCase().includes(filter)
    );
  }, [interacoes, filterFuncionario]);

  const stats: ComissaoStats = useMemo(() => {
    const totalMatriculas = filteredInteracoes.length;
    const totalValorPlano = filteredInteracoes.reduce((sum, int) => sum + (int.valor_plano || 0), 0);
    const ticketMedio = totalMatriculas > 0 ? totalValorPlano / totalMatriculas : 0;
    const totalComissaoCadastrador = filteredInteracoes.reduce((sum, int) => sum + (int.comissao_comercial || 0), 0);
    const totalComissaoFechador = filteredInteracoes.reduce((sum, int) => sum + (int.comissao_recepcao || 0), 0);

    return { totalMatriculas, ticketMedio, totalComissaoCadastrador, totalComissaoFechador };
  }, [filteredInteracoes]);

  const comissoesCadastrador: ComissaoAgrupada[] = useMemo(() => {
    const grouped = new Map<string, { leadsSet: Set<string>; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const comissao = int.comissao_comercial || 0;
      if (comissao <= 0) return;

      const cadastradorOriginal = int.lead_cadastrado_por || 'Não informado';
      const cadastrador = normalizeCadastrador(cadastradorOriginal);
      
      if (deveExcluirResponsavel(cadastrador)) return;
      
      const current = grouped.get(cadastrador) || { leadsSet: new Set(), comissao: 0 };
      current.leadsSet.add(int.lead_id);
      current.comissao += comissao;
      grouped.set(cadastrador, current);
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        matriculas: data.leadsSet.size,
        comissao: data.comissao,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  const comissoesFechador: ComissaoAgrupada[] = useMemo(() => {
    const grouped = new Map<string, { leadsSet: Set<string>; comissao: number }>();

    filteredInteracoes.forEach((int) => {
      const comissao = int.comissao_recepcao || 0;
      if (comissao <= 0) return;

      const responsavelOriginal = int.responsavel_fechamento || 'Não informado';
      const responsavel = normalizeCadastrador(responsavelOriginal);
      
      if (deveExcluirResponsavel(responsavel)) return;
      
      const current = grouped.get(responsavel) || { leadsSet: new Set(), comissao: 0 };
      current.leadsSet.add(int.lead_id);
      current.comissao += comissao;
      grouped.set(responsavel, current);
    });

    return Array.from(grouped.entries())
      .map(([responsavel, data]) => ({
        responsavel,
        matriculas: data.leadsSet.size,
        comissao: data.comissao,
      }))
      .sort((a, b) => b.comissao - a.comissao);
  }, [filteredInteracoes]);

  const bonusTreinadores: TreinadorBonus[] = useMemo(() => {
    const grouped = new Map<string, { aulasSet: Set<string>; matriculasSet: Set<string>; faturamento: number }>();

    filteredInteracoes.forEach((int) => {
      const treinadorOriginal = int.treinador_responsavel;
      
      if (!isValidTreinador(treinadorOriginal)) return;
      if (deveExcluirResponsavel(treinadorOriginal)) return;
      
      const treinador = padronizarTreinadorComissoes(treinadorOriginal!);
      const current = grouped.get(treinador) || { aulasSet: new Set(), matriculasSet: new Set(), faturamento: 0 };
      
      if (int.fechou_matricula) {
        current.matriculasSet.add(int.lead_id);
        current.faturamento += (int.valor_plano || 0);
      }

      grouped.set(treinador, current);
    });

    const filtro = filterFuncionario.trim().toLowerCase();
    experimentais.forEach((exp) => {
      const original = exp.treinador_responsavel;
      if (!isValidTreinador(original)) return;
      if (deveExcluirResponsavel(original)) return;
      if (filtro && !original!.toLowerCase().includes(filtro)) return;
      const treinador = padronizarTreinadorComissoes(original!);
      const current = grouped.get(treinador) || { aulasSet: new Set(), matriculasSet: new Set(), faturamento: 0 };
      current.aulasSet.add(exp.lead_id);
      grouped.set(treinador, current);
    });

    return Array.from(grouped.entries())
      .map(([treinador, data]) => {
        const aulas = data.aulasSet.size;
        const matriculas = data.matriculasSet.size;
        const faturamento = data.faturamento;
        const conversao = calcularConversaoTreinador(data.aulasSet, data.matriculasSet);
        
        const bonusPorAluno = calcularBonusPorAluno(matriculas);
        const bonusTotal = matriculas * bonusPorAluno;
        
        return { treinador, aulas, matriculas, faturamento, conversao, bonusPorAluno, bonusTotal };
      })
      .filter(t => t.aulas > 0 || t.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [filteredInteracoes, experimentais, filterFuncionario]);

  const treinadorStats: TreinadorStats = useMemo(() => {
    const totalMatriculas = bonusTreinadores.reduce((sum, t) => sum + t.matriculas, 0);
    const totalBonus = bonusTreinadores.reduce((sum, t) => sum + t.bonusTotal, 0);
    return { totalMatriculas, totalBonus };
  }, [bonusTreinadores]);

  const totalComissoes = useMemo(() => {
    return stats.totalComissaoCadastrador + stats.totalComissaoFechador + treinadorStats.totalBonus;
  }, [stats.totalComissaoCadastrador, stats.totalComissaoFechador, treinadorStats.totalBonus]);

  return {
    loading,
    mes,
    setMes,
    ano,
    setAno,
    filterFuncionario,
    setFilterFuncionario,
    filteredInteracoes,
    interacoes,
    stats,
    comissoesCadastrador,
    comissoesFechador,
    bonusTreinadores,
    treinadorStats,
    totalComissoes,
    refetch: fetchComissoes,
  };
}

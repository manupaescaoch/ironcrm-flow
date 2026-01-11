import { useMemo } from 'react';
import { Lead, Interacao } from '@/types/database';
import {
  TopCards,
  FunilItem,
  OrigemItem,
  AgendaPresencaData,
  CadastradorItem,
  FechadorItem,
  TreinadorItem,
  ResumoFinal,
} from '@/components/executivo/constants';
import {
  padronizarOrigem,
  deveExcluirResponsavel,
  padronizarResponsavel,
  padronizarTreinador,
  calcularBonusPorAluno,
} from '@/utils/executivoMappers';

interface UseExecutivoMetricsReturn {
  topCards: TopCards;
  funilExecutivo: FunilItem[];
  origemData: OrigemItem[];
  agendaPresenca: AgendaPresencaData;
  performanceCadastrador: CadastradorItem[];
  performanceFechador: FechadorItem[];
  performanceTreinadores: TreinadorItem[];
  resumoFinal: ResumoFinal;
}

export function useExecutivoMetrics(leads: Lead[], interacoes: Interacao[]): UseExecutivoMetricsReturn {
  
  // ==================== TOP CARDS ====================
  const topCards = useMemo<TopCards>(() => {
    const leadsDoMes = leads.length;
    
    const agendamentosSet = new Set(interacoes.filter(i => i.agendou_experimental === true).map(i => i.lead_id));
    const comparecimentosSet = new Set(interacoes.filter(i => i.compareceu === true).map(i => i.lead_id));
    const matriculasSet = new Set(interacoes.filter(i => i.fechou_matricula === true).map(i => i.lead_id));
    
    const agendamentos = agendamentosSet.size;
    const comparecimentos = comparecimentosSet.size;
    const matriculas = matriculasSet.size;
    
    // Taxa Atendimento → Aluno (já existia)
    const taxaConversao = comparecimentos > 0 ? (matriculas / comparecimentos) * 100 : 0;
    
    // Taxa Lead → Atendimento (NOVO)
    const taxaLeadAtendimento = leadsDoMes > 0 ? (comparecimentos / leadsDoMes) * 100 : 0;
    
    // Faturamento e Ticket Médio (NOVO)
    const matriculasComValor = interacoes.filter(i => i.fechou_matricula === true && (i.valor_plano || 0) > 0);
    const faturamentoTotal = matriculasComValor.reduce((sum, i) => sum + (i.valor_plano || 0), 0);
    const ticketMedio = matriculas > 0 ? faturamentoTotal / matriculas : 0;
    
    // LTV - Lifetime Value (Ticket Médio x Meses de Retenção Média)
    const MESES_RETENCAO_MEDIA = 8;
    const ltv = ticketMedio * MESES_RETENCAO_MEDIA;

    return { 
      leadsDoMes, 
      agendamentos, 
      comparecimentos, 
      matriculas, 
      taxaConversao, 
      taxaLeadAtendimento,
      faturamentoTotal,
      ticketMedio,
      ltv
    };
  }, [leads, interacoes]);

  // ==================== FUNIL EXECUTIVO ====================
  const funilExecutivo = useMemo<FunilItem[]>(() => {
    const leadsTotal = leads.length;
    
    const contatoFeitoSet = new Set(interacoes.filter(i => i.atendido_por).map(i => i.lead_id));
    const agendamentosSet = new Set(interacoes.filter(i => i.agendou_experimental === true).map(i => i.lead_id));
    const comparecimentosSet = new Set(interacoes.filter(i => i.compareceu === true).map(i => i.lead_id));
    const matriculasSet = new Set(interacoes.filter(i => i.fechou_matricula === true).map(i => i.lead_id));
    
    const contatoFeito = contatoFeitoSet.size;
    const agendamentos = agendamentosSet.size;
    const comparecimentos = comparecimentosSet.size;
    const matriculas = matriculasSet.size;

    return [
      { etapa: 'Leads', quantidade: leadsTotal, conversao: null },
      { etapa: 'Contato Feito', quantidade: contatoFeito, conversao: leadsTotal > 0 ? (contatoFeito / leadsTotal) * 100 : 0 },
      { etapa: 'Agendamentos', quantidade: agendamentos, conversao: contatoFeito > 0 ? (agendamentos / contatoFeito) * 100 : 0 },
      { etapa: 'Comparecimentos', quantidade: comparecimentos, conversao: agendamentos > 0 ? (comparecimentos / agendamentos) * 100 : 0 },
      { etapa: 'Matrículas', quantidade: matriculas, conversao: comparecimentos > 0 ? (matriculas / comparecimentos) * 100 : 0 },
    ];
  }, [leads, interacoes]);

  // ==================== ORIGEM DOS LEADS ====================
  const origemData = useMemo<OrigemItem[]>(() => {
    const grouped = new Map<string, { leads: number; matriculasSet: Set<string> }>();
    
    leads.forEach(lead => {
      const origem = padronizarOrigem(lead.origem);
      const current = grouped.get(origem) || { leads: 0, matriculasSet: new Set() };
      grouped.set(origem, { ...current, leads: current.leads + 1 });
    });

    interacoes.filter(i => i.fechou_matricula === true).forEach(int => {
      const lead = leads.find(l => l.id === int.lead_id);
      const origem = padronizarOrigem(lead?.origem);
      const current = grouped.get(origem) || { leads: 0, matriculasSet: new Set() };
      current.matriculasSet.add(int.lead_id);
      grouped.set(origem, current);
    });

    return Array.from(grouped.entries()).map(([origem, data]) => ({
      origem,
      leads: data.leads,
      matriculas: data.matriculasSet.size,
      conversao: data.leads > 0 ? (data.matriculasSet.size / data.leads) * 100 : 0,
    })).sort((a, b) => b.leads - a.leads);
  }, [leads, interacoes]);

  // ==================== AGENDA & PRESENÇA ====================
  const agendaPresenca = useMemo<AgendaPresencaData>(() => {
    const agendamentosPorData = new Map<string, { agendados: number; compareceram: number }>();
    
    interacoes.filter(i => i.data_experimental).forEach(int => {
      const data = int.data_experimental!;
      const current = agendamentosPorData.get(data) || { agendados: 0, compareceram: 0 };
      agendamentosPorData.set(data, {
        agendados: current.agendados + 1,
        compareceram: current.compareceram + (int.compareceu ? 1 : 0),
      });
    });

    const rows = Array.from(agendamentosPorData.entries())
      .map(([data, stats]) => ({
        data,
        agendados: stats.agendados,
        compareceram: stats.compareceram,
        noShow: stats.agendados > 0 ? ((stats.agendados - stats.compareceram) / stats.agendados) * 100 : 0,
      }))
      .sort((a, b) => b.data.localeCompare(a.data));

    const totalAgendados = rows.reduce((sum, r) => sum + r.agendados, 0);
    const totalCompareceram = rows.reduce((sum, r) => sum + r.compareceram, 0);
    const mediaNoShow = totalAgendados > 0 ? ((totalAgendados - totalCompareceram) / totalAgendados) * 100 : 0;
    
    const melhorDia = rows.length > 0 ? rows.reduce((best, r) => {
      const presenca = r.agendados > 0 ? (r.compareceram / r.agendados) * 100 : 0;
      const bestPresenca = best.agendados > 0 ? (best.compareceram / best.agendados) * 100 : 0;
      return presenca > bestPresenca ? r : best;
    }) : null;

    const piorDia = rows.length > 0 ? rows.reduce((worst, r) => {
      const presenca = r.agendados > 0 ? (r.compareceram / r.agendados) * 100 : 0;
      const worstPresenca = worst.agendados > 0 ? (worst.compareceram / worst.agendados) * 100 : 0;
      return presenca < worstPresenca ? r : worst;
    }) : null;

    return { rows, mediaNoShow, melhorDia, piorDia };
  }, [interacoes]);

  // ==================== PERFORMANCE POR CADASTRADOR ====================
  const performanceCadastrador = useMemo<CadastradorItem[]>(() => {
    const grouped = new Map<string, { leadsSet: Set<string>; agendamentosSet: Set<string>; matriculasSet: Set<string> }>();

    interacoes.forEach(int => {
      const cadastradorOriginal = int.cadastrado_por || '';
      if (!cadastradorOriginal || deveExcluirResponsavel(cadastradorOriginal)) return;
      
      const cadastrador = padronizarResponsavel(cadastradorOriginal);
      const current = grouped.get(cadastrador) || { leadsSet: new Set(), agendamentosSet: new Set(), matriculasSet: new Set() };
      
      current.leadsSet.add(int.lead_id);
      if (int.agendou_experimental) current.agendamentosSet.add(int.lead_id);
      if (int.fechou_matricula) current.matriculasSet.add(int.lead_id);
      
      grouped.set(cadastrador, current);
    });

    return Array.from(grouped.entries())
      .map(([cadastrador, data]) => ({
        cadastrador,
        leads: data.leadsSet.size,
        agendamentos: data.agendamentosSet.size,
        matriculas: data.matriculasSet.size,
        conversao: data.agendamentosSet.size > 0 ? (data.matriculasSet.size / data.agendamentosSet.size) * 100 : 0,
      }))
      .filter(r => r.leads > 0 || r.agendamentos > 0 || r.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== PERFORMANCE POR FECHADOR ====================
  const performanceFechador = useMemo<FechadorItem[]>(() => {
    const grouped = new Map<string, { comparecimentosSet: Set<string>; matriculasSet: Set<string>; valorTotal: number }>();

    interacoes.forEach(int => {
      if (int.fechou_matricula) {
        const fechadorOriginal = int.responsavel_fechamento || int.atendido_por || '';
        if (!fechadorOriginal || deveExcluirResponsavel(fechadorOriginal)) return;
        
        const fechador = padronizarResponsavel(fechadorOriginal);
        const current = grouped.get(fechador) || { comparecimentosSet: new Set(), matriculasSet: new Set(), valorTotal: 0 };
        current.matriculasSet.add(int.lead_id);
        current.valorTotal += (int.valor_plano || 0);
        grouped.set(fechador, current);
      }
      
      if (int.compareceu) {
        const atendidoOriginal = int.atendido_por || '';
        if (!atendidoOriginal || deveExcluirResponsavel(atendidoOriginal)) return;
        
        const atendido = padronizarResponsavel(atendidoOriginal);
        const current = grouped.get(atendido) || { comparecimentosSet: new Set(), matriculasSet: new Set(), valorTotal: 0 };
        current.comparecimentosSet.add(int.lead_id);
        grouped.set(atendido, current);
      }
    });

    return Array.from(grouped.entries())
      .map(([fechador, data]) => ({
        fechador,
        atendimentos: 0,
        comparecimentos: data.comparecimentosSet.size,
        matriculas: data.matriculasSet.size,
        valorTotal: data.valorTotal,
        conversao: data.comparecimentosSet.size > 0 ? (data.matriculasSet.size / data.comparecimentosSet.size) * 100 : 0,
      }))
      .filter(r => r.comparecimentos > 0 || r.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== PERFORMANCE TREINADORES ====================
  const performanceTreinadores = useMemo<TreinadorItem[]>(() => {
    const grouped = new Map<string, { aulasSet: Set<string>; matriculasSet: Set<string> }>();

    interacoes.forEach(int => {
      const treinadorOriginal = int.treinador_responsavel;
      if (!treinadorOriginal) return;
      if (deveExcluirResponsavel(treinadorOriginal)) return;
      
      const treinador = padronizarTreinador(treinadorOriginal);
      const current = grouped.get(treinador) || { aulasSet: new Set(), matriculasSet: new Set() };
      
      if (int.compareceu) {
        current.aulasSet.add(int.lead_id);
      }
      
      if (int.fechou_matricula) {
        current.matriculasSet.add(int.lead_id);
      }

      grouped.set(treinador, current);
    });

    return Array.from(grouped.entries())
      .map(([treinador, data]) => {
        const aulas = data.aulasSet.size;
        const matriculas = data.matriculasSet.size;
        const conversao = aulas > 0 ? (matriculas / aulas) * 100 : 0;
        const bonusPorAluno = calcularBonusPorAluno(matriculas);
        const bonusTotal = matriculas * bonusPorAluno;

        return { treinador, aulas, matriculas, conversao, bonusPorAluno, bonusTotal };
      })
      .filter(t => t.aulas > 0 || t.matriculas > 0)
      .sort((a, b) => b.matriculas - a.matriculas);
  }, [interacoes]);

  // ==================== RESUMO FINAL ====================
  const resumoFinal = useMemo<ResumoFinal>(() => {
    const totalLeads = leads.length;
    
    const totalAgendamentos = new Set(interacoes.filter(i => i.agendou_experimental === true).map(i => i.lead_id)).size;
    const totalComparecimentos = new Set(interacoes.filter(i => i.compareceu === true).map(i => i.lead_id)).size;
    const totalMatriculas = new Set(interacoes.filter(i => i.fechou_matricula === true).map(i => i.lead_id)).size;
    const conversaoGeral = totalComparecimentos > 0 ? (totalMatriculas / totalComparecimentos) * 100 : 0;
    const mediaNoShow = agendaPresenca.mediaNoShow;

    const melhorCadastrador = performanceCadastrador.length > 0 ? performanceCadastrador[0].cadastrador : '-';
    const melhorFechador = performanceFechador.length > 0 ? performanceFechador[0].fechador : '-';
    const melhorTreinador = performanceTreinadores.length > 0 ? performanceTreinadores[0].treinador : '-';

    return {
      totalLeads,
      totalAgendamentos,
      totalComparecimentos,
      totalMatriculas,
      conversaoGeral,
      mediaNoShow,
      melhorCadastrador,
      melhorFechador,
      melhorTreinador,
    };
  }, [leads, interacoes, agendaPresenca, performanceCadastrador, performanceFechador, performanceTreinadores]);

  return {
    topCards,
    funilExecutivo,
    origemData,
    agendaPresenca,
    performanceCadastrador,
    performanceFechador,
    performanceTreinadores,
    resumoFinal,
  };
}

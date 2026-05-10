import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const UNIDADES = {
  ZN: { id: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6', label: 'ZONA NORTE' },
  ZS: { id: 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a', label: 'ZONA SUL' },
} as const;

export type Periodo = 'hoje' | 'semana' | 'mes';
export type UnidadeFiltro = 'todas' | 'ZN' | 'ZS';

function rangeFromPeriodo(periodo: Periodo) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  if (periodo === 'semana') start.setDate(start.getDate() - 6);
  if (periodo === 'mes') start.setDate(start.getDate() - 29);
  return { start, end };
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function unidadesAlvo(u: UnidadeFiltro): Array<keyof typeof UNIDADES> {
  if (u === 'todas') return ['ZN', 'ZS'];
  return [u];
}

export function useDashboardOperacionalData(periodo: Periodo, unidade: UnidadeFiltro) {
  return useQuery({
    queryKey: ['dashboard-operacional', periodo, unidade],
    queryFn: async () => {
      const { start, end } = rangeFromPeriodo(periodo);
      const today = todayStr();
      const startISO = start.toISOString();
      const endISO = end.toISOString();
      const startDate = start.toISOString().slice(0, 10);
      const endDate = end.toISOString().slice(0, 10);

      const alvos = unidadesAlvo(unidade);
      const labelsAlvo = alvos.map((k) => UNIDADES[k].label);
      const idsAlvo = alvos.map((k) => UNIDADES[k].id);

      // Alunos ativos por unidade
      const ativosPorUnidade: Record<string, number> = { ZN: 0, ZS: 0 };
      for (const k of ['ZN', 'ZS'] as const) {
        const { count } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('unidade_id', UNIDADES[k].id)
          .eq('is_matriculado', true)
          .eq('ativo', true);
        ativosPorUnidade[k] = count || 0;
      }

      // Experimentais hoje (compareceu = true) por unidade
      const expHojePorUnidade: Record<string, number> = { ZN: 0, ZS: 0 };
      for (const k of ['ZN', 'ZS'] as const) {
        const { count } = await supabase
          .from('interacoes')
          .select('*', { count: 'exact', head: true })
          .eq('unidade_id', UNIDADES[k].id)
          .eq('data_experimental', today)
          .eq('compareceu', true);
        expHojePorUnidade[k] = count || 0;
      }

      // Fechamentos hoje
      const fechHojePorUnidade: Record<string, number> = { ZN: 0, ZS: 0 };
      for (const k of ['ZN', 'ZS'] as const) {
        const { count } = await supabase
          .from('interacoes')
          .select('*', { count: 'exact', head: true })
          .eq('unidade_id', UNIDADES[k].id)
          .eq('fechou_matricula', true)
          .eq('data_fechamento', today);
        fechHojePorUnidade[k] = count || 0;
      }

      // Cancelamentos hoje (de relatorios diarios)
      const cancHojePorUnidade: Record<string, number> = { ZN: 0, ZS: 0 };
      const { data: relatHoje } = await supabase
        .from('relatorio_diario_comercial_respostas')
        .select('unidade, cancelamentos')
        .eq('data', today);
      relatHoje?.forEach((r: any) => {
        if (r.unidade === 'ZONA NORTE') cancHojePorUnidade.ZN += r.cancelamentos || 0;
        if (r.unidade === 'ZONA SUL') cancHojePorUnidade.ZS += r.cancelamentos || 0;
      });

      // Série semanal: leads, experimentais, fechamentos por dia (últimos 7 dias)
      const dias: Array<{ dia: string; leads: number; experimentais: number; fechamentos: number; date: string }> = [];
      const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().slice(0, 10);
        dias.push({ dia: diasNomes[d.getDay()], date: dStr, leads: 0, experimentais: 0, fechamentos: 0 });
      }
      const semStart = dias[0].date;
      const semEnd = dias[dias.length - 1].date;

      const { data: leadsSem } = await supabase
        .from('leads')
        .select('created_at, unidade_id')
        .gte('created_at', `${semStart}T00:00:00`)
        .lte('created_at', `${semEnd}T23:59:59`)
        .in('unidade_id', idsAlvo);
      leadsSem?.forEach((l: any) => {
        const dStr = (l.created_at as string).slice(0, 10);
        const slot = dias.find((x) => x.date === dStr);
        if (slot) slot.leads++;
      });
      const { data: intSem } = await supabase
        .from('interacoes')
        .select('data_experimental, data_fechamento, compareceu, fechou_matricula, unidade_id')
        .in('unidade_id', idsAlvo)
        .or(`data_experimental.gte.${semStart},data_fechamento.gte.${semStart}`);
      intSem?.forEach((i: any) => {
        if (i.compareceu && i.data_experimental) {
          const slot = dias.find((x) => x.date === i.data_experimental);
          if (slot) slot.experimentais++;
        }
        if (i.fechou_matricula && i.data_fechamento) {
          const slot = dias.find((x) => x.date === i.data_fechamento);
          if (slot) slot.fechamentos++;
        }
      });

      // === RECEPÇÃO: somatório dos relatorios do periodo, filtrados por unidade ===
      const { data: relats } = await supabase
        .from('relatorio_diario_comercial_respostas')
        .select('*')
        .gte('data', startDate)
        .lte('data', endDate)
        .in('unidade', labelsAlvo)
        .order('data', { ascending: false });

      const recepcao = {
        leadsRecebidos: 0, experimentaisRealizadas: 0, novosFechamentos: 0,
        renovacoes: 0, cancelamentos: 0, inadimplentes: 0, naoRenovados: 0,
        atividades: new Set<string>(), pendencias: [] as string[],
        planejamento: [] as string[], suporte: '' as string,
      };
      relats?.forEach((r: any) => {
        recepcao.leadsRecebidos += r.leads_recebidos || 0;
        recepcao.experimentaisRealizadas += r.experimentais_realizadas || 0;
        recepcao.novosFechamentos += r.novos_alunos || 0;
        recepcao.renovacoes += r.renovacoes || 0;
        recepcao.cancelamentos += r.cancelamentos || 0;
        if (Array.isArray(r.atividades_realizadas)) r.atividades_realizadas.forEach((a: string) => recepcao.atividades.add(a));
        if (r.pendencias) recepcao.pendencias.push(r.pendencias);
        if (r.plano_amanha) recepcao.planejamento.push(r.plano_amanha);
        if (r.precisa_suporte && r.suporte_descricao && !recepcao.suporte) recepcao.suporte = r.suporte_descricao;
      });
      // Pegar últimos inadimplentes/não renovados como texto (só do mais recente)
      const ultimoRel = relats?.[0];

      // === ESTAGIÁRIO LÍDER: encerramento_turno_respostas no periodo, agrupado por turno ===
      const { data: turnos } = await supabase
        .from('encerramento_turno_respostas')
        .select('*')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .in('unidade', labelsAlvo)
        .order('created_at', { ascending: false });

      const turnosMap = new Map<string, any>();
      turnos?.forEach((t: any) => {
        if (!turnosMap.has(t.turno)) turnosMap.set(t.turno, t);
      });
      const estagiarioTurnos = ['Manhã', 'Tarde', 'Noite'].map((nome) => {
        const t = turnosMap.get(nome) || turnosMap.get(nome.toLowerCase());
        if (!t) return null;
        return {
          nome,
          ocorrencias: { tem: !!t.teve_ocorrencia, descricao: t.ocorrencia_descricao || '' },
          padraoAtendimento: !!t.manteve_padrao,
          padraoIron: !!t.manteve_padrao,
          destaquePositivo: { nome: t.nome || '', descricao: t.padrao_observacao || '' },
          feedbackCorretivo: { nome: t.recebeu_feedback ? t.nome : '', descricao: t.feedback_descricao || '' },
          climaEquipe: t.clima_equipe || 0,
          equipamentos: t.equipamento_problema && t.equipamento_descricao ? [{ nome: 'Equipamento', descricao: t.equipamento_descricao }] : [],
          feedbacksAlunos: { positivos: [] as string[], negativos: t.recebeu_feedback && t.feedback_descricao ? [t.feedback_descricao] : [] },
          autoavaliacao: { faria: t.faria_diferente || '', suporte: t.precisou_suporte ? t.suporte_descricao || '' : '' },
        };
      }).filter(Boolean);

      // === COORDENADOR DE HORÁRIO ===
      const { data: horarios } = await supabase
        .from('encerramento_horario_respostas')
        .select('*')
        .gte('data', startDate)
        .lte('data', endDate)
        .in('unidade', labelsAlvo)
        .order('created_at', { ascending: false });
      const horMap = new Map<string, any>();
      horarios?.forEach((h: any) => {
        if (!horMap.has(h.turno)) horMap.set(h.turno, h);
      });
      const coordHorarioTurnos = ['Manhã', 'Tarde', 'Noite'].map((nome) => {
        const h = horMap.get(nome) || horMap.get(nome.toLowerCase());
        if (!h) return null;
        // Parse atendimentos por treinador (texto livre)
        const atendTreinador: Array<{ nome: string; qtd: number }> = [];
        if (h.atendimentos_por_treinador) {
          const linhas = String(h.atendimentos_por_treinador).split(/[,;\n]/);
          linhas.forEach((l: string) => {
            const m = l.match(/([^:0-9]+?)[\s:-]+(\d+)/);
            if (m) atendTreinador.push({ nome: m[1].trim(), qtd: parseInt(m[2]) });
          });
        }
        return {
          nome,
          atendimentosTreinador: atendTreinador,
          experimentais: h.experimentais_realizadas || 0,
          notaGeral: h.nota_geral || 0,
          ocorrencias: h.teve_ocorrencia ? [{ tipo: 'Ocorrência', gravidade: 'média', descricao: h.ocorrencia_descricao || '', status: 'resolvido' }] : [],
          feedbacks: {
            positivos: h.destaque_positivo && h.destaque_descricao ? [h.destaque_descricao] : [],
            negativos: h.teve_feedback_aluno && h.feedback_aluno_descricao ? [h.feedback_aluno_descricao] : [],
          },
          destaqueTreinador: h.destaque_positivo ? (h.destaque_descricao || '—') : '—',
          feedbackCorretivoNome: h.feedback_corretivo ? (h.feedback_corretivo_descricao || '') : '',
          salaOrganizada: !!h.sala_organizada,
          pendenciasSala: h.pendencia_organizacao || '',
        };
      }).filter(Boolean);

      // === COORDENADOR DE UNIDADE ===
      const { data: coords } = await supabase
        .from('encerramento_coordenador_respostas')
        .select('*')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .in('unidade', labelsAlvo)
        .order('created_at', { ascending: false });

      const avg = (arr: any[], k: string) => {
        const vals = arr.map((x) => x[k]).filter((v) => v != null);
        if (!vals.length) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
      };
      const ucList = coords || [];
      const avaliacoes = {
        limpeza: avg(ucList, 'limpeza_geral'),
        equipamentos: avg(ucList, 'equipamentos_funcionando'),
        climatizacao: avg(ucList, 'climatizacao'),
        organizacao: avg(ucList, 'organizacao_espaco'),
        infraestrutura: avg(ucList, 'infraestrutura'),
        postura: avg(ucList, 'postura_atendimento'),
        proatividade: avg(ucList, 'proatividade'),
        notaGeral: avg(ucList, 'nota_geral'),
      };
      const destaquesPos: Array<{ nome: string; descricao: string }> = [];
      const destaquesCorr: Array<{ nome: string; descricao: string }> = [];
      const ocorrenciasU: any[] = [];
      const reclamacoes: string[] = [];
      const elogios: string[] = [];
      const pontosAtencao: string[] = [];
      const pendencias: string[] = [];
      let presencaIssues: string[] = [];
      let padraoIron = true;
      ucList.forEach((c: any) => {
        if (c.destaque_positivo && c.destaque_descricao) destaquesPos.push({ nome: 'Destaque', descricao: c.destaque_descricao });
        if (c.feedback_corretivo && c.feedback_descricao) destaquesCorr.push({ nome: 'Corretivo', descricao: c.feedback_descricao });
        if (c.teve_ocorrencia && c.ocorrencia_descricao) {
          ocorrenciasU.push({
            gravidade: c.ocorrencia_gravidade || 'baixa',
            descricao: c.ocorrencia_descricao,
            acao: c.ocorrencia_acao || '—',
            status: c.ocorrencia_resolvida ? 'resolvido' : 'pendente',
          });
        }
        if (c.reclamacao_aluno && c.reclamacao_descricao) reclamacoes.push(c.reclamacao_descricao);
        if (c.elogio_aluno && c.elogio_descricao) elogios.push(c.elogio_descricao);
        if (c.pontos_atencao) pontosAtencao.push(c.pontos_atencao);
        if (c.pendencias_abertas) pendencias.push(c.pendencias_abertas);
        if (c.faltas_atrasos) presencaIssues.push(c.faltas_atrasos);
        if (c.padrao_iron === false) padraoIron = false;
      });

      return {
        visaoGeral: {
          alunosAtivosZN: ativosPorUnidade.ZN,
          alunosAtivosZS: ativosPorUnidade.ZS,
          experimentaisHoje: { ZN: expHojePorUnidade.ZN, ZS: expHojePorUnidade.ZS },
          fechamentosHoje: { ZN: fechHojePorUnidade.ZN, ZS: fechHojePorUnidade.ZS },
          cancelamentosHoje: { ZN: cancHojePorUnidade.ZN, ZS: cancHojePorUnidade.ZS },
          semana: dias.map(({ dia, leads, experimentais, fechamentos }) => ({ dia, leads, experimentais, fechamentos })),
          comparativo: [
            { metrica: 'Ativos', ZN: ativosPorUnidade.ZN, ZS: ativosPorUnidade.ZS },
            { metrica: 'Experimentais', ZN: expHojePorUnidade.ZN, ZS: expHojePorUnidade.ZS },
            { metrica: 'Fechamentos', ZN: fechHojePorUnidade.ZN, ZS: fechHojePorUnidade.ZS },
            { metrica: 'Cancelamentos', ZN: cancHojePorUnidade.ZN, ZS: cancHojePorUnidade.ZS },
          ],
        },
        recepcao: {
          leadsRecebidos: recepcao.leadsRecebidos,
          experimentaisRealizadas: recepcao.experimentaisRealizadas,
          novosFechamentos: recepcao.novosFechamentos,
          renovacoes: recepcao.renovacoes,
          cancelamentos: recepcao.cancelamentos,
          inadimplentes: ultimoRel?.inadimplentes ? String(ultimoRel.inadimplentes).split(/[,;\n]/).filter(Boolean).length : 0,
          naoRenovados: ultimoRel?.nao_renovados ? String(ultimoRel.nao_renovados).split(/[,;\n]/).filter(Boolean).length : 0,
          atividades: Array.from(recepcao.atividades),
          pendencias: recepcao.pendencias,
          planejamento: recepcao.planejamento,
          suporte: recepcao.suporte,
        },
        estagiario: { turnos: estagiarioTurnos as any[] },
        coordHorario: { turnos: coordHorarioTurnos as any[] },
        coordUnidade: {
          avaliacoes,
          presenca: presencaIssues.length
            ? presencaIssues.map((x) => ({ nome: x, status: 'atrasou' }))
            : [],
          destaques: { positivos: destaquesPos, corretivos: destaquesCorr },
          ocorrencias: ocorrenciasU,
          reclamacoes,
          elogios,
          padraoIron,
          fechamento: { pontosAtencao, pendencias },
        },
        totalRelatorios: relats?.length || 0,
        totalEncerramentos: (turnos?.length || 0) + (horarios?.length || 0) + (coords?.length || 0),
      };
    },
    refetchInterval: 60_000,
  });
}

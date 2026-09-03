import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { toDateKey, type OpsExecucao, type OpsStatus } from '@/hooks/useOpsExecucao';
import { deriveOpsStatus } from '@/components/ops/OpsStatusBadge';

export interface OpsGestaoTarefa {
  id: string;
  titulo: string;
  horario: string | null;
  prazo: string | null;
  setor: string | null;
  prioridade: string;
  unidade_id: string;
  unidade_nome: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  status: OpsStatus;
  concluido_em: string | null;
  observacao: string | null;
  exige_evidencia: boolean;
  execucao: OpsExecucao | null;
}

export interface OpsResumoUnidade {
  unidade_id: string;
  unidade_nome: string;
  total: number;
  concluidas: number;
  atrasadas: number;
  emAndamento: number;
  pendentes: number;
  criticasAtrasadas: number;
  percentual: number;
}

const sel = (s: string): string => s;

/** Visão de gestão do dia: todas as unidades permitidas ao usuário (RLS ainda limita no banco). */
export function useOpsGestao(date: Date = new Date()) {
  const { unidadesPermitidas } = useUnidade();
  const dataKey = toDateKey(date);
  const diaSemana = date.getDay();
  const unidadeIds = useMemo(() => unidadesPermitidas.map((u) => u.id), [unidadesPermitidas]);
  const nomePorUnidade = useMemo(
    () => new Map(unidadesPermitidas.map((u) => [u.id, u.nome])),
    [unidadesPermitidas],
  );

  const query = useQuery({
    queryKey: ['ops-gestao-dia', dataKey, unidadeIds.join(',')],
    enabled: unidadeIds.length > 0,
    queryFn: async (): Promise<OpsGestaoTarefa[]> => {
      const { data, error } = await supabase
        .from('cronograma_atividades')
        .select(
          sel(
            'id, titulo, horario, prazo, setor, prioridade, status, unidade_id, responsavel_id, exige_evidencia, cronograma_funcionarios(nome)',
          ),
        )
        .in('unidade_id', unidadeIds)
        .eq('ativo', true)
        .eq('dia_semana', diaSemana)
        .order('horario', { ascending: true });
      if (error) throw error;

      const atividades = ((data as any[]) || []).filter((a) => a.status !== 'cancelada');

      let execucoes: OpsExecucao[] = [];
      if (atividades.length > 0) {
        const { data: execData, error: execErr } = await supabase
          .from('ops_execucoes')
          .select('*')
          .eq('data_execucao', dataKey)
          .in(
            'atividade_id',
            atividades.map((a) => a.id as string),
          );
        if (execErr) throw execErr;
        execucoes = (execData || []) as unknown as OpsExecucao[];
      }
      const execByAtividade = new Map(execucoes.map((e) => [e.atividade_id, e]));

      return atividades.map((a): OpsGestaoTarefa => {
        const execucao = execByAtividade.get(a.id as string) || null;
        const base = (execucao?.status as OpsStatus) || 'pendente';
        return {
          id: a.id,
          titulo: a.titulo,
          horario: a.horario ?? null,
          prazo: a.prazo ?? null,
          setor: a.setor ?? null,
          prioridade: a.prioridade ?? 'normal',
          unidade_id: a.unidade_id,
          unidade_nome: nomePorUnidade.get(a.unidade_id) ?? '—',
          responsavel_id: a.responsavel_id ?? null,
          responsavel_nome: a.cronograma_funcionarios?.nome ?? null,
          status: deriveOpsStatus(base, { data: dataKey, horario: a.horario, prazo: a.prazo }),
          concluido_em: execucao?.concluido_em ?? null,
          observacao: execucao?.observacao ?? null,
          exige_evidencia: !!a.exige_evidencia,
          execucao,
        };
      });
    },
  });

  const tarefas = query.data || [];

  const resumoPorUnidade: OpsResumoUnidade[] = useMemo(() => {
    const map = new Map<string, OpsResumoUnidade>();
    for (const t of tarefas) {
      let r = map.get(t.unidade_id);
      if (!r) {
        r = {
          unidade_id: t.unidade_id,
          unidade_nome: t.unidade_nome,
          total: 0,
          concluidas: 0,
          atrasadas: 0,
          emAndamento: 0,
          pendentes: 0,
          criticasAtrasadas: 0,
          percentual: 0,
        };
        map.set(t.unidade_id, r);
      }
      r.total += 1;
      if (t.status === 'concluida') r.concluidas += 1;
      if (t.status === 'atrasada') r.atrasadas += 1;
      if (t.status === 'em_andamento') r.emAndamento += 1;
      if (t.status === 'pendente') r.pendentes += 1;
      if (t.status === 'atrasada' && t.prioridade === 'critica') r.criticasAtrasadas += 1;
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, percentual: r.total ? Math.round((r.concluidas / r.total) * 100) : 0 }))
      .sort((a, b) => a.unidade_nome.localeCompare(b.unidade_nome));
  }, [tarefas]);

  /** ATENÇÃO: apenas tarefas críticas atrasadas. */
  const criticasAtrasadas = useMemo(
    () => tarefas.filter((t) => t.status === 'atrasada' && t.prioridade === 'critica'),
    [tarefas],
  );

  const responsaveis = useMemo(() => {
    const map = new Map<string, string>();
    tarefas.forEach((t) => {
      if (t.responsavel_id && t.responsavel_nome) map.set(t.responsavel_id, t.responsavel_nome);
    });
    return Array.from(map, ([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [tarefas]);

  const setores = useMemo(
    () => Array.from(new Set(tarefas.map((t) => t.setor).filter(Boolean) as string[])).sort(),
    [tarefas],
  );

  return { ...query, tarefas, resumoPorUnidade, criticasAtrasadas, responsaveis, setores, dataKey };
}

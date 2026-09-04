import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { toDateKey, type OpsExecucao, type OpsStatus } from '@/hooks/useOpsExecucao';
import { deriveOpsStatus } from '@/components/ops/OpsStatusBadge';

export interface OpsGestaoTarefa {
  id: string;
  tipo: 'atividade' | 'rotina';
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

const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

/** Prioridades de rotina (alta/media/baixa) para o padrão do EVO OPS */
function prioridadeRotina(p: string | null): string {
  if (p === 'media' || !p) return 'normal';
  return p;
}

function rotinaAplicaNoDia(frequencia: string | null, dayKey: string): boolean {
  const freq = frequencia || 'diaria';
  if (freq.startsWith('semanal:')) {
    const dias = freq.split(':')[1]?.split(',') || [];
    return dias.includes(dayKey);
  }
  return true;
}

/**
 * Visão de gestão do dia — estritamente da unidade atual selecionada.
 * Reúne as atividades do cronograma e as rotinas do dia.
 */
export function useOpsGestao(date: Date = new Date()) {
  const { unidadeAtual } = useUnidade();
  const dataKey = toDateKey(date);
  const diaSemana = date.getDay();
  const dayKey = DAY_KEYS[diaSemana];
  const unidadeId = unidadeAtual?.id ?? null;
  const unidadeNome = unidadeAtual?.nome ?? '—';

  const query = useQuery({
    queryKey: ['ops-gestao-dia', dataKey, unidadeId],
    enabled: !!unidadeId,
    queryFn: async (): Promise<OpsGestaoTarefa[]> => {
      const [atvRes, rotRes] = await Promise.all([
        supabase
          .from('cronograma_atividades')
          .select(
            sel(
              'id, titulo, horario, prazo, setor, prioridade, status, dia_semana, unidade_id, responsavel_id, exige_evidencia, cronograma_funcionarios(nome)',
            ),
          )
          .eq('unidade_id', unidadeId!)
          .eq('ativo', true)
          .or(`dia_semana.eq.${diaSemana},dia_semana.is.null`)
          .order('horario', { ascending: true }),
        supabase
          .from('rotinas')
          .select('id, nome, setor, prioridade, horario_esperado, frequencia, responsavel_principal, unidade_id')
          .eq('unidade_id', unidadeId!)
          .eq('ativo', true)
          .eq('arquivada', false),
      ]);
      if (atvRes.error) throw atvRes.error;
      if (rotRes.error) throw rotRes.error;

      const atividades = ((atvRes.data as any[]) || []).filter((a) => a.status !== 'cancelada');
      const rotinas = ((rotRes.data as any[]) || []).filter((r) => rotinaAplicaNoDia(r.frequencia, dayKey));

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

      let rotExec: any[] = [];
      if (rotinas.length > 0) {
        const { data: rotExecData, error: rotExecErr } = await supabase
          .from('rotina_execucoes')
          .select('rotina_id, atividade_id, concluida, concluida_em')
          .eq('data_execucao', dataKey)
          .in(
            'rotina_id',
            rotinas.map((r) => r.id as string),
          );
        if (rotExecErr) throw rotExecErr;
        rotExec = rotExecData || [];
      }
      const rotExecByRotina = new Map(
        rotExec.filter((e) => !e.atividade_id).map((e) => [e.rotina_id as string, e]),
      );

      const itensAtividades = atividades.map((a): OpsGestaoTarefa => {
        const execucao = execByAtividade.get(a.id as string) || null;
        const base = (execucao?.status as OpsStatus) || 'pendente';
        return {
          id: a.id,
          tipo: 'atividade',
          titulo: a.titulo,
          horario: a.horario ?? null,
          prazo: a.prazo ?? null,
          setor: a.setor ?? null,
          prioridade: a.prioridade ?? 'normal',
          unidade_id: a.unidade_id,
          unidade_nome: unidadeNome,
          responsavel_id: a.responsavel_id ?? null,
          responsavel_nome: a.cronograma_funcionarios?.nome ?? null,
          status: deriveOpsStatus(base, { data: dataKey, horario: a.horario, prazo: a.prazo }),
          concluido_em: execucao?.concluido_em ?? null,
          observacao: execucao?.observacao ?? null,
          exige_evidencia: !!a.exige_evidencia,
          execucao,
        };
      });

      const itensRotinas = rotinas.map((r): OpsGestaoTarefa => {
        const exec = rotExecByRotina.get(r.id as string);
        const concluida = !!exec?.concluida;
        return {
          id: r.id,
          tipo: 'rotina',
          titulo: r.nome,
          horario: r.horario_esperado ?? null,
          prazo: null,
          setor: r.setor ?? null,
          prioridade: prioridadeRotina(r.prioridade),
          unidade_id: r.unidade_id,
          unidade_nome: unidadeNome,
          responsavel_id: null,
          responsavel_nome: r.responsavel_principal ?? null,
          status: concluida
            ? 'concluida'
            : deriveOpsStatus('pendente', { data: dataKey, horario: r.horario_esperado ?? null, prazo: null }),
          concluido_em: exec?.concluida_em ?? null,
          observacao: null,
          exige_evidencia: false,
          execucao: null,
        };
      });

      return [...itensAtividades, ...itensRotinas].sort((a, b) =>
        (a.horario || '99:99').localeCompare(b.horario || '99:99'),
      );
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

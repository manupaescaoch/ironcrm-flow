import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { toDateKey, type OpsExecucao, type OpsStatus } from '@/hooks/useOpsExecucao';
import { deriveOpsStatus } from '@/components/ops/OpsStatusBadge';

export interface OpsTarefaDoDia {
  id: string;
  tipo: 'atividade' | 'rotina';
  titulo: string;
  descricao: string | null;
  instrucao: string | null;
  horario: string | null;
  prazo: string | null;
  setor: string | null;
  prioridade: string | null;
  unidade_id: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  exige_evidencia: boolean;
  exige_confirmacao: boolean;
  minha: boolean;
  status: OpsStatus;
  execucao: OpsExecucao | null;
}

export type OpsEscopo = 'minhas' | 'unidade';

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

export function useOpsMeuDia(escopo: OpsEscopo = 'minhas', date: Date = new Date()) {
  const { unidadeId } = useUnidadeFilter();
  const { user } = useAuth();
  const dataKey = toDateKey(date);
  const diaSemana = date.getDay();
  const dayKey = DAY_KEYS[diaSemana];


  const query = useQuery({
    queryKey: ['ops-meu-dia', unidadeId, user?.id, dataKey],
    enabled: !!unidadeId && !!user?.id,
    queryFn: async () => {
      const [funcRes, atvRes] = await Promise.all([
        supabase
          .from('cronograma_funcionarios')
          .select(sel('id, nome'))
          .eq('user_id', user!.id),
        supabase
          .from('cronograma_atividades')
          .select(
            sel(
              'id, titulo, descricao, instrucao, horario, prazo, setor, prioridade, status, unidade_id, responsavel_id, exige_evidencia, exige_confirmacao, cronograma_funcionarios(nome)',
            ),
          )
          .eq('unidade_id', unidadeId!)
          .eq('ativo', true)
          .or(`dia_semana.eq.${diaSemana},dia_semana.is.null`)
          .order('horario', { ascending: true }),

      ]);
      if (funcRes.error) throw funcRes.error;
      if (atvRes.error) throw atvRes.error;

      const meusFuncIds = new Set(((funcRes.data as any[]) || []).map((f) => f.id as string));
      const atividades = ((atvRes.data as any[]) || []).filter((a) => a.status !== 'cancelada');

      let execucoes: OpsExecucao[] = [];
      if (atividades.length > 0) {
        const { data: execData, error: execErr } = await supabase
          .from('ops_execucoes')
          .select('*')
          .eq('data_execucao', dataKey)
          .in('atividade_id', atividades.map((a) => a.id as string));
        if (execErr) throw execErr;
        execucoes = (execData || []) as unknown as OpsExecucao[];
      }
      const execByAtividade = new Map(execucoes.map((e) => [e.atividade_id, e]));

      return atividades.map((a): OpsTarefaDoDia => {
        const execucao = execByAtividade.get(a.id as string) || null;
        const base = (execucao?.status as OpsStatus) || 'pendente';
        return {
          id: a.id,
          titulo: a.titulo,
          descricao: a.descricao ?? null,
          instrucao: a.instrucao ?? null,
          horario: a.horario ?? null,
          prazo: a.prazo ?? null,
          setor: a.setor ?? null,
          prioridade: a.prioridade ?? 'normal',
          unidade_id: a.unidade_id,
          responsavel_id: a.responsavel_id ?? null,
          responsavel_nome: a.cronograma_funcionarios?.nome ?? null,
          exige_evidencia: !!a.exige_evidencia,
          exige_confirmacao: !!a.exige_confirmacao,
          minha: !!a.responsavel_id && meusFuncIds.has(a.responsavel_id),
          status: deriveOpsStatus(base, { data: dataKey, horario: a.horario, prazo: a.prazo }),
          execucao,
        };
      });
    },
  });

  const todas = query.data || [];
  const temVinculo = todas.some((t) => t.minha);
  const tarefas = escopo === 'minhas' && temVinculo ? todas.filter((t) => t.minha) : todas;

  const resumo = {
    total: tarefas.length,
    concluidas: tarefas.filter((t) => t.status === 'concluida').length,
    emAndamento: tarefas.filter((t) => t.status === 'em_andamento').length,
    atrasadas: tarefas.filter((t) => t.status === 'atrasada').length,
    pendentes: tarefas.filter((t) => t.status === 'pendente').length,
  };

  return { ...query, tarefas, todas, temVinculo, resumo, dataKey };
}

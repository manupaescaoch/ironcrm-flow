import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { toast } from '@/hooks/use-toast';

export interface CronogramaAtividade {
  id: string;
  unidade_id: string;
  formulario_id: string | null;
  responsavel_id: string | null;
  titulo: string;
  horario: string | null;
  dia_semana: number | null;
  mensagem: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  descricao?: string | null;
  instrucao?: string | null;
  setor?: string | null;
  prioridade?: string | null;
  status?: string | null;
  prazo?: string | null;
  exige_evidencia?: boolean | null;
  exige_confirmacao?: boolean | null;
  cronograma_funcionarios?: { nome: string } | null;
  formularios?: { titulo: string } | null;
}


export function useCronogramaAtividades() {
  const { unidadeId, hasUnidade } = useUnidadeFilter();
  const queryClient = useQueryClient();

  const { data: atividades = [], isLoading } = useQuery({
    queryKey: ['cronograma-atividades', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      const { data, error } = await supabase
        .from('cronograma_atividades')
        .select('*, cronograma_funcionarios(nome), formularios(titulo)')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
        .order('horario');
      if (error) throw error;
      return data as CronogramaAtividade[];
    },
    enabled: hasUnidade,
  });

  const createAtividade = useMutation({
    mutationFn: async (atv: Array<{ unidade_id: string; titulo: string; horario?: string; responsavel_id?: string; formulario_id?: string; dia_semana?: number; mensagem?: string; prioridade?: string; setor?: string | null }>) => {
      const { error } = await supabase.from('cronograma_atividades').insert(atv);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      toast({ title: variables.length > 1 ? 'Atividades criadas' : 'Atividade criada' });
    },
    onError: () => toast({ title: 'Erro ao criar atividade', variant: 'destructive' }),
  });

  const updateAtividade = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; titulo?: string; horario?: string | null; responsavel_id?: string | null; formulario_id?: string | null; dia_semana?: number | null; mensagem?: string | null; prioridade?: string; setor?: string | null }) => {
      const { error } = await supabase.from('cronograma_atividades').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      toast({ title: 'Atividade atualizada' });
    },
    onError: () => toast({ title: 'Erro ao atualizar atividade', variant: 'destructive' }),
  });

  const bulkUpdateAtividades = useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: { titulo?: string; horario?: string | null; responsavel_id?: string | null; formulario_id?: string | null; mensagem?: string | null; prioridade?: string; setor?: string | null } }) => {
      const { error } = await supabase.from('cronograma_atividades').update(data).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      toast({ title: 'Todas as atividades relacionadas foram atualizadas' });
    },
    onError: () => toast({ title: 'Erro ao atualizar atividades', variant: 'destructive' }),
  });

  const bulkDeleteAtividades = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('cronograma_atividades').update({ ativo: false }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      toast({ title: 'Todas as atividades relacionadas foram removidas' });
    },
  });

  const deleteAtividade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cronograma_atividades').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      toast({ title: 'Atividade removida' });
    },
  });

  const cancelAtividades = useMutation({
    mutationFn: async ({ ids, motivo }: { ids: string[]; motivo: string }) => {
      const motivoTrim = motivo.trim();
      if (!motivoTrim) throw new Error('Informe o motivo do cancelamento');
      const { data: authData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('cronograma_atividades')
        .update({
          status: 'cancelada',
          motivo_cancelamento: motivoTrim,
          cancelado_por: authData?.user?.id ?? null,
          cancelado_em: new Date().toISOString(),
          ativo: false,
        } as any)
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      toast({ title: vars.ids.length > 1 ? `${vars.ids.length} atividades canceladas` : 'Atividade cancelada' });
    },
    onError: (e: any) => toast({ title: 'Erro ao cancelar', description: e?.message, variant: 'destructive' }),
  });

  return { atividades, isLoading, createAtividade, updateAtividade, bulkUpdateAtividades, bulkDeleteAtividades, deleteAtividade, cancelAtividades };
}

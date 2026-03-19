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
  ativo: boolean;
  created_at: string;
  updated_at: string;
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
    mutationFn: async (atv: Array<{ unidade_id: string; titulo: string; horario?: string; responsavel_id?: string; formulario_id?: string; dia_semana?: number }>) => {
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
    mutationFn: async ({ id, ...data }: { id: string; titulo?: string; horario?: string | null; responsavel_id?: string | null; formulario_id?: string | null; dia_semana?: number | null }) => {
      const { error } = await supabase.from('cronograma_atividades').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-atividades'] });
      toast({ title: 'Atividade atualizada' });
    },
    onError: () => toast({ title: 'Erro ao atualizar atividade', variant: 'destructive' }),
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

  return { atividades, isLoading, createAtividade, deleteAtividade };
}

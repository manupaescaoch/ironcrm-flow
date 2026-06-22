import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidadeFilter } from '@/hooks/useUnidadeFilter';
import { toast } from '@/hooks/use-toast';

export type CargoFuncionario = 'recepcao' | 'coordenador_unidade' | 'treinador' | 'estagiario_lider';

export interface CronogramaFuncionario {
  id: string;
  unidade_id: string;
  nome: string;
  telefone: string | null;
  setor: string;
  turno: string;
  cargo: CargoFuncionario | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useCronogramaFuncionarios() {
  const { unidadeId, hasUnidade } = useUnidadeFilter();
  const queryClient = useQueryClient();

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ['cronograma-funcionarios', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return [];
      const { data, error } = await supabase
        .from('cronograma_funcionarios')
        .select('*')
        .eq('unidade_id', unidadeId)
        .order('nome');
      if (error) throw error;
      return data as CronogramaFuncionario[];
    },
    enabled: hasUnidade,
  });

  const createFuncionario = useMutation({
    mutationFn: async (func: Omit<CronogramaFuncionario, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await supabase.from('cronograma_funcionarios').insert(func);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-funcionarios'] });
      toast({ title: 'Funcionário cadastrado com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao cadastrar funcionário', variant: 'destructive' }),
  });

  const updateFuncionario = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CronogramaFuncionario> & { id: string }) => {
      const { error } = await supabase.from('cronograma_funcionarios').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-funcionarios'] });
      toast({ title: 'Funcionário atualizado' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  });

  const deleteFuncionario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cronograma_funcionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronograma-funcionarios'] });
      toast({ title: 'Funcionário removido' });
    },
    onError: () => toast({ title: 'Erro ao remover', variant: 'destructive' }),
  });

  return {
    funcionarios,
    isLoading,
    createFuncionario,
    updateFuncionario,
    deleteFuncionario,
    ativos: funcionarios.filter(f => f.ativo),
  };
}

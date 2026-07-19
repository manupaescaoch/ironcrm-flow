import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { normalizeTipo } from '@/lib/cronogramaTipos';

export interface CronogramaAtividadeAdmin {
  id: string;
  titulo: string;
  horario: string | null;
  dia_semana: number | null;
  ativo: boolean;
  unidade_id: string;
  responsavel_id: string | null;
  formulario_id: string | null;
  mensagem: string | null;
  turno: string | null;
  tipo_atividade: string | null;
  unidades?: { nome: string } | null;
  cronograma_funcionarios?: { nome: string } | null;
}

const QK = ['admin-all-cronograma-atividades'];

export function useCronogramaAdminData() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: QK,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cronograma_atividades')
        .select('id, titulo, horario, dia_semana, ativo, unidade_id, responsavel_id, formulario_id, mensagem, turno, tipo_atividade, unidades(nome), cronograma_funcionarios(nome)' as any)
        .order('dia_semana', { ascending: true })
        .order('horario', { ascending: true });
      if (error) throw error;
      // Fallback: preencher tipo local se ainda null
      return ((data as any[]) || []).map((r) => ({
        ...r,
        tipo_atividade: r.tipo_atividade || normalizeTipo(r.titulo),
      })) as CronogramaAtividadeAdmin[];
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async (args: {
      ids: string[];
      patch?: Record<string, any>;
      add_dias?: number[] | null;
      replace_dias?: number[] | null;
      duplicate?: boolean;
      delete?: boolean;
    }) => {
      const { data, error } = await supabase.rpc('admin_bulk_update_cronograma' as any, {
        p_ids: args.ids,
        p_patch: args.patch ?? {},
        p_add_dias: args.add_dias ?? null,
        p_replace_dias: args.replace_dias ?? null,
        p_duplicate: args.duplicate ?? false,
        p_delete: args.delete ?? false,
      });
      if (error) throw error;
      return data as { affected: number; bulk_operation_id: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: QK });
      toast({ title: `${res?.affected ?? 0} automações atualizadas` });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const updateSingle = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CronogramaAtividadeAdmin> }) => {
      const { error } = await supabase.from('cronograma_atividades').update(patch as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK });
      toast({ title: 'Atividade atualizada' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return { ...query, bulkUpdate, updateSingle };
}

export function useCronogramaHistorico(open: boolean) {
  return useQuery({
    queryKey: ['cronograma-historico'],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_cronograma_historico' as any, { p_limit: 300 });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });
}

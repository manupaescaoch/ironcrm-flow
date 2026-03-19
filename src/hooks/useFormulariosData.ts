import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { toast } from '@/hooks/use-toast';

export interface FormularioCampo {
  id?: string;
  formulario_id?: string;
  tipo: string;
  label: string;
  opcoes?: string[] | null;
  ordem: number;
  obrigatorio: boolean;
}

export interface Formulario {
  id: string;
  unidade_id: string;
  titulo: string;
  descricao: string | null;
  setor: string;
  turno: string;
  whatsapp_grupo: string | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormularioResposta {
  id: string;
  formulario_id: string;
  unidade_id: string;
  respondido_por_nome: string;
  respondido_por_telefone: string | null;
  respostas: Record<string, any>;
  enviado_grupo: boolean;
  created_at: string;
}

export function useFormularios() {
  const { unidadeAtual } = useUnidade();

  return useQuery({
    queryKey: ['formularios', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data, error } = await supabase
        .from('formularios')
        .select('*')
        .eq('unidade_id', unidadeAtual.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Formulario[];
    },
    enabled: !!unidadeAtual?.id,
  });
}

export function useFormularioCampos(formularioId: string | null) {
  return useQuery({
    queryKey: ['formulario_campos', formularioId],
    queryFn: async () => {
      if (!formularioId) return [];
      const { data, error } = await supabase
        .from('formulario_campos')
        .select('*')
        .eq('formulario_id', formularioId)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return data as (FormularioCampo & { id: string; formulario_id: string })[];
    },
    enabled: !!formularioId,
  });
}

export function useFormularioRespostas(formularioId: string | null) {
  const { unidadeAtual } = useUnidade();

  return useQuery({
    queryKey: ['formulario_respostas', formularioId, unidadeAtual?.id],
    queryFn: async () => {
      if (!formularioId) return [];
      const { data, error } = await supabase
        .from('formulario_respostas')
        .select('*')
        .eq('formulario_id', formularioId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FormularioResposta[];
    },
    enabled: !!formularioId,
  });
}

export function useAllRespostas() {
  const { unidadeAtual } = useUnidade();

  return useQuery({
    queryKey: ['all_formulario_respostas', unidadeAtual?.id],
    queryFn: async () => {
      if (!unidadeAtual?.id) return [];
      const { data, error } = await supabase
        .from('formulario_respostas')
        .select('*, formularios(titulo)')
        .eq('unidade_id', unidadeAtual.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!unidadeAtual?.id,
  });
}

export function useCreateFormulario() {
  const queryClient = useQueryClient();
  const { unidadeAtual } = useUnidade();

  return useMutation({
    mutationFn: async ({ titulo, descricao, setor, turno, whatsapp_grupo, campos }: { titulo: string; descricao?: string; setor?: string; turno?: string; whatsapp_grupo?: string; campos: FormularioCampo[] }) => {
      if (!unidadeAtual?.id) throw new Error('Unidade não selecionada');

      const { data: form, error: formError } = await supabase
        .from('formularios')
        .insert({ titulo, descricao: descricao || null, setor: setor || 'geral', turno: turno || 'integral', whatsapp_grupo: whatsapp_grupo || null, unidade_id: unidadeAtual.id })
        .select()
        .single();
      if (formError) throw formError;

      if (campos.length > 0) {
        const camposToInsert = campos.map((c, i) => ({
          formulario_id: form.id,
          tipo: c.tipo,
          label: c.label,
          opcoes: c.opcoes || null,
          ordem: i,
          obrigatorio: c.obrigatorio,
        }));
        const { error: camposError } = await supabase
          .from('formulario_campos')
          .insert(camposToInsert);
        if (camposError) throw camposError;
      }

      return form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios'] });
      toast({ title: 'Formulário criado com sucesso!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao criar formulário', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateFormulario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, titulo, descricao, setor, turno, whatsapp_grupo, ativo, campos }: { id: string; titulo: string; descricao?: string; setor?: string; turno?: string; whatsapp_grupo?: string; ativo?: boolean; campos?: FormularioCampo[] }) => {
      const { error: formError } = await supabase
        .from('formularios')
        .update({ titulo, descricao: descricao || null, setor: setor || 'geral', turno: turno || 'integral', whatsapp_grupo: whatsapp_grupo || null, ...(ativo !== undefined ? { ativo } : {}) })
        .eq('id', id);
      if (formError) throw formError;

      if (campos) {
        // Delete existing and re-insert
        await supabase.from('formulario_campos').delete().eq('formulario_id', id);
        if (campos.length > 0) {
          const camposToInsert = campos.map((c, i) => ({
            formulario_id: id,
            tipo: c.tipo,
            label: c.label,
            opcoes: c.opcoes || null,
            ordem: i,
            obrigatorio: c.obrigatorio,
          }));
          const { error: camposError } = await supabase
            .from('formulario_campos')
            .insert(camposToInsert);
          if (camposError) throw camposError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios'] });
      queryClient.invalidateQueries({ queryKey: ['formulario_campos'] });
      toast({ title: 'Formulário atualizado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteFormulario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('formularios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios'] });
      toast({ title: 'Formulário excluído!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    },
  });
}

export function useToggleFormulario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('formularios')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formularios'] });
    },
  });
}

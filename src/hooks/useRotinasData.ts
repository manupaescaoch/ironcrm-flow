import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/errorMessages';

async function sendRotinaWhatsApp(responsavel: string, rotinaNome: string, rotinaDescricao: string | null, unidadeNome: string, creatorName: string) {
  if (!responsavel) return;
  try {
    await supabase.functions.invoke('send-task-whatsapp', {
      body: {
        responsavel_name: responsavel,
        task_title: rotinaNome,
        task_description: rotinaDescricao || '',
        tipo: 'nova_tarefa',
        creator_name: creatorName,
        unidade_nome: unidadeNome,
      },
    });
  } catch (err) {
    console.error('Erro ao enviar WhatsApp da rotina:', err);
  }
}

export interface Rotina {
  id: string;
  unidade_id: string;
  nome: string;
  descricao: string | null;
  setor: string;
  responsavel_principal: string | null;
  responsavel_conferencia: string | null;
  frequencia: string;
  horario_esperado: string | null;
  prioridade: string;
  ativo: boolean;
  arquivada: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RotinaAtividade {
  id: string;
  rotina_id: string;
  titulo: string;
  responsavel: string | null;
  horario: string | null;
  observacao: string | null;
  ordem: number;
  created_at: string;
}

export interface RotinaExecucao {
  id: string;
  rotina_id: string;
  atividade_id: string | null;
  data_execucao: string;
  concluida: boolean;
  concluida_por: string | null;
  concluida_em: string | null;
  observacao: string | null;
  foto_url: string | null;
  unidade_id: string;
  created_at: string;
}

export type RotinaInsert = Omit<Rotina, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'ativo' | 'arquivada'>;
export type AtividadeInsert = Omit<RotinaAtividade, 'id' | 'created_at' | 'ordem'>;

export const SETORES = [
  'Coordenação', 'Limpeza', 'Recepção', 'Comercial', 'Treinadores', 'Manutenção', 'Geral'
] as const;

export const FREQUENCIAS = [
  { value: 'diaria', label: 'Diária' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'mensal', label: 'Mensal' },
] as const;

export const PRIORIDADES_ROTINA = [
  { value: 'alta', label: 'Alta', color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  { value: 'media', label: 'Média', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  { value: 'baixa', label: 'Baixa', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
] as const;

export function useRotinasData() {
  const { unidadeAtual } = useUnidade();
  const { user, userName } = useAuth();
  const { toast } = useToast();
  const [rotinas, setRotinas] = useState<Rotina[]>([]);
  const [atividades, setAtividades] = useState<RotinaAtividade[]>([]);
  const [execucoes, setExecucoes] = useState<RotinaExecucao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!unidadeAtual?.id) return;
    setLoading(true);
    try {
      const [rotinasRes, atividadesRes, execucoesRes] = await Promise.all([
        supabase.from('rotinas').select('*').eq('unidade_id', unidadeAtual.id).order('setor').order('nome'),
        supabase.from('rotina_atividades').select('*').order('ordem'),
        supabase.from('rotina_execucoes').select('*').eq('unidade_id', unidadeAtual.id).eq('data_execucao', new Date().toISOString().split('T')[0]),
      ]);

      if (rotinasRes.data) setRotinas(rotinasRes.data as Rotina[]);
      if (atividadesRes.data) setAtividades(atividadesRes.data as RotinaAtividade[]);
      if (execucoesRes.data) setExecucoes(execucoesRes.data as RotinaExecucao[]);
    } catch (err) {
      console.error('Error fetching rotinas:', err);
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime for execucoes
  useEffect(() => {
    if (!unidadeAtual?.id) return;
    const channel = supabase
      .channel('rotina_execucoes_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rotina_execucoes' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [unidadeAtual?.id, fetchData]);

  const createRotina = useCallback(async (data: RotinaInsert, newAtividades: Omit<AtividadeInsert, 'rotina_id'>[]) => {
    const { data: rotina, error } = await supabase.from('rotinas').insert(data as any).select().single();
    if (error) {
      toast({ title: 'Erro ao criar rotina', description: error.message, variant: 'destructive' });
      return null;
    }
    console.log('[Rotinas] Atividades a salvar:', newAtividades.length, JSON.stringify(newAtividades));
    if (newAtividades.length > 0 && rotina) {
      const ativs = newAtividades.map((a, i) => ({ ...a, rotina_id: rotina.id, ordem: i }));
      console.log('[Rotinas] Inserindo atividades:', JSON.stringify(ativs));
      const { error: atError, data: atData } = await supabase.from('rotina_atividades').insert(ativs as any).select();
      console.log('[Rotinas] Resultado insert atividades:', atError, atData);
      if (atError) {
        toast({ title: 'Erro ao salvar atividades', description: atError.message, variant: 'destructive' });
      }
    }
    toast({ title: 'Rotina criada com sucesso' });

    // Enviar WhatsApp para responsável principal
    if (data.responsavel_principal && unidadeAtual?.nome) {
      sendRotinaWhatsApp(data.responsavel_principal, data.nome, data.descricao, unidadeAtual.nome, userName || 'Sistema');
    }
    // Enviar WhatsApp para responsáveis das atividades (se diferente do principal)
    const notified = new Set<string>([data.responsavel_principal || '']);
    newAtividades.forEach(a => {
      if (a.responsavel && !notified.has(a.responsavel) && unidadeAtual?.nome) {
        sendRotinaWhatsApp(a.responsavel, data.nome, data.descricao, unidadeAtual.nome, userName || 'Sistema');
        notified.add(a.responsavel);
      }
    });

    await fetchData();
    return rotina;
  }, [toast, fetchData, unidadeAtual, userName]);

  const updateRotina = useCallback(async (id: string, data: Partial<RotinaInsert>) => {
    const { error } = await supabase.from('rotinas').update(data as any).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao atualizar rotina', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Rotina atualizada' });
    await fetchData();
  }, [toast, fetchData]);

  const deleteRotina = useCallback(async (id: string) => {
    const { error } = await supabase.from('rotinas').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir rotina', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Rotina excluída' });
    await fetchData();
  }, [toast, fetchData]);

  const duplicateRotina = useCallback(async (rotina: Rotina) => {
    const { id, created_at, updated_at, created_by, ...rest } = rotina;
    const { data: newRotina, error } = await supabase.from('rotinas').insert({ ...rest, nome: `${rest.nome} (cópia)` } as any).select().single();
    if (error || !newRotina) {
      toast({ title: 'Erro ao duplicar rotina', variant: 'destructive' });
      return;
    }
    const rotinaAtividades = atividades.filter(a => a.rotina_id === id);
    if (rotinaAtividades.length > 0) {
      const newAtivs = rotinaAtividades.map(({ id: _, rotina_id, created_at: __, ...a }) => ({ ...a, rotina_id: newRotina.id }));
      await supabase.from('rotina_atividades').insert(newAtivs as any);
    }
    toast({ title: 'Rotina duplicada com sucesso' });
    await fetchData();
  }, [atividades, toast, fetchData]);

  const toggleExecucao = useCallback(async (rotinaId: string, atividadeId: string | null, concluida: boolean) => {
    if (!unidadeAtual?.id) return;
    const today = new Date().toISOString().split('T')[0];
    const existing = execucoes.find(e => e.rotina_id === rotinaId && e.atividade_id === atividadeId && e.data_execucao === today);
    
    if (existing) {
      const { error } = await supabase.from('rotina_execucoes').update({
        concluida,
        concluida_por: concluida ? (userName || 'Usuário') : null,
        concluida_em: concluida ? new Date().toISOString() : null,
      } as any).eq('id', existing.id);
      if (error) {
        toast({ title: 'Erro ao salvar execução', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      const { error } = await supabase.from('rotina_execucoes').insert({
        rotina_id: rotinaId,
        atividade_id: atividadeId,
        data_execucao: today,
        concluida,
        concluida_por: concluida ? (userName || 'Usuário') : null,
        concluida_em: concluida ? new Date().toISOString() : null,
        unidade_id: unidadeAtual.id,
      } as any);
      if (error) {
        toast({ title: 'Erro ao salvar execução', description: error.message, variant: 'destructive' });
        return;
      }
    }
    await fetchData();
  }, [unidadeAtual?.id, execucoes, userName, fetchData, toast]);

  const saveAtividades = useCallback(async (rotinaId: string, newAtividades: Omit<AtividadeInsert, 'rotina_id'>[]) => {
    // Delete existing
    const { error: delError } = await supabase.from('rotina_atividades').delete().eq('rotina_id', rotinaId);
    if (delError) {
      toast({ title: 'Erro ao atualizar atividades', description: delError.message, variant: 'destructive' });
      await fetchData();
      return;
    }
    // Insert new
    if (newAtividades.length > 0) {
      const ativs = newAtividades.map((a, i) => ({ ...a, rotina_id: rotinaId, ordem: i }));
      const { error: insError } = await supabase.from('rotina_atividades').insert(ativs as any);
      if (insError) {
        toast({ title: 'Erro ao salvar atividades', description: insError.message, variant: 'destructive' });
      }
    }
    await fetchData();
  }, [fetchData, toast]);

  return {
    rotinas, atividades, execucoes, loading,
    createRotina, updateRotina, deleteRotina, duplicateRotina,
    toggleExecucao, saveAtividades, refetch: fetchData,
  };
}

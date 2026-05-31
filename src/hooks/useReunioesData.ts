import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Reuniao {
  id: string;
  unidade_id: string;
  tipo: string;
  data: string;
  responsavel: string | null;
  participantes: string[];
  pauta: string | null;
  feedback: string | null;
  status: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReuniaoInput {
  tipo: string;
  unidade_id: string;
  data: string;
  responsavel?: string | null;
  participantes: string[];
  pauta?: string | null;
  feedback?: string | null;
  status?: string;
}

export function useReunioesData() {
  const { unidadeAtual, unidadesPermitidas } = useUnidade();
  const { isAdmin } = useAuth();
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReunioes = useCallback(async () => {
    if (!unidadeAtual) {
      setReunioes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('reunioes')
        .select('*')
        .order('data', { ascending: false });
      if (!isAdmin) {
        const ids = unidadesPermitidas.map((u) => u.id);
        query = query.in('unidade_id', ids.length ? ids : [unidadeAtual.id]);
      }
      const { data, error } = await query;
      if (error) throw error;
      setReunioes((data || []) as unknown as Reuniao[]);
    } catch (err: any) {
      console.error('Erro ao buscar reuniões:', err);
      toast({ title: 'Erro ao carregar reuniões', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual, isAdmin]);

  useEffect(() => {
    fetchReunioes();
  }, [fetchReunioes]);

  const createReuniao = useCallback(async (input: ReuniaoInput) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from('reunioes')
      .insert({
        ...input,
        criado_por: userData.user?.id ?? null,
      } as any)
      .select('*')
      .single();
    if (error) throw error;
    await fetchReunioes();
    return created;
  }, [fetchReunioes]);

  const deleteReuniao = useCallback(async (id: string) => {
    const { error } = await supabase.from('reunioes').delete().eq('id', id);
    if (error) throw error;
    await fetchReunioes();
  }, [fetchReunioes]);

  return { reunioes, loading, refetch: fetchReunioes, createReuniao, deleteReuniao };
}

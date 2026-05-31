import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUnidade } from '@/contexts/UnidadeContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Encaminhamento {
  id: string;
  reuniao_id: string;
  unidade_id: string;
  acao: string;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  prazo: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Reuniao {
  id: string;
  unidade_id: string;
  tipo: string;
  data: string;
  participantes: string[];
  numeros_periodo: Record<string, number | string | null>;
  pauta: string | null;
  decisoes: string | null;
  resumo: string | null;
  status: string;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  encaminhamentos?: Encaminhamento[];
}

export interface EncaminhamentoInput {
  acao: string;
  responsavel_id?: string | null;
  responsavel_nome?: string | null;
  prazo?: string | null;
  status?: string;
}

export interface ReuniaoInput {
  tipo: string;
  unidade_id: string;
  data: string;
  participantes: string[];
  numeros_periodo: Record<string, number | string | null>;
  pauta?: string | null;
  decisoes?: string | null;
  resumo?: string | null;
  status?: string;
  encaminhamentos: EncaminhamentoInput[];
}

export function useReunioesData() {
  const { unidadeAtual } = useUnidade();
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
        .select('*, encaminhamentos:reunioes_encaminhamentos(*)')
        .order('data', { ascending: false });
      if (!isAdmin) {
        query = query.eq('unidade_id', unidadeAtual.id);
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
    const { encaminhamentos, ...reuniaoData } = input;

    const { data: created, error } = await supabase
      .from('reunioes')
      .insert({
        ...reuniaoData,
        criado_por: userData.user?.id ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;

    if (encaminhamentos.length > 0) {
      const payload = encaminhamentos.map((e) => ({
        reuniao_id: created.id,
        unidade_id: created.unidade_id,
        acao: e.acao,
        responsavel_id: e.responsavel_id ?? null,
        responsavel_nome: e.responsavel_nome ?? null,
        prazo: e.prazo ?? null,
        status: e.status ?? 'aberto',
      }));
      const { error: encErr } = await supabase.from('reunioes_encaminhamentos').insert(payload);
      if (encErr) throw encErr;
    }

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

export function useEncaminhamentosPendentes() {
  const { unidadeAtual } = useUnidade();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<(Encaminhamento & { reuniao: Pick<Reuniao, 'id' | 'tipo' | 'data' | 'unidade_id'> })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!unidadeAtual) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('reunioes_encaminhamentos')
        .select('*, reuniao:reunioes!inner(id,tipo,data,unidade_id)')
        .neq('status', 'concluido')
        .order('prazo', { ascending: true, nullsFirst: false });
      if (!isAdmin) {
        query = query.eq('unidade_id', unidadeAtual.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setItems((data || []) as any);
    } catch (err: any) {
      console.error('Erro ao buscar pendentes:', err);
      toast({ title: 'Erro ao carregar pendentes', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [unidadeAtual, isAdmin]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    const { error } = await supabase
      .from('reunioes_encaminhamentos')
      .update({ status })
      .eq('id', id);
    if (error) throw error;
    await fetch();
  }, [fetch]);

  return { items, loading, refetch: fetch, updateStatus };
}

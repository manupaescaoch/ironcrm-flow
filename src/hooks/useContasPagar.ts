import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnidade } from '@/contexts/UnidadeContext';
import { getTodayInBrasilia } from '@/lib/brasilia';
import { useToast } from '@/hooks/use-toast';
import {
  ContaEnvio,
  ContaHistorico,
  ContaPagar,
  ContaStatusView,
  computeStatus,
} from '@/components/contas-pagar/constants';

export interface ContaFormPayload {
  descricao: string;
  fornecedor: string;
  categoria: string;
  prioridade: string;
  centro_custo: string | null;
  competencia: string | null;
  observacoes: string | null;
  valor: number;
  data_vencimento: string;
  forma_pagamento: string;
  numero_fatura: string | null;
  codigo_barras: string | null;
  linha_digitavel: string | null;
  chave_pix: string | null;
  codigo_pix: string | null;
  banco: string | null;
  agencia: string | null;
  conta_bancaria: string | null;
  favorecido: string | null;
  documento_url: string | null;
}

export interface BaixaPayload {
  id: string;
  valor_pago: number;
  data_pagamento: string;
  forma_pagamento_baixa: string;
  juros: number;
  multa: number;
  desconto: number;
  comprovante_url: string | null;
  baixa_observacoes: string | null;
}

export function useContasPagar(from: string, to: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user, userRole, isAdmin } = useAuth();
  const { unidadeAtual } = useUnidade();
  const unidadeId = unidadeAtual?.id ?? null;
  const hoje = getTodayInBrasilia();

  const canManage = isAdmin || userRole === 'comercial';

  const userNome = useMemo(() => {
    const meta = (user?.user_metadata || {}) as Record<string, string>;
    return meta.full_name || meta.name || user?.email?.split('@')[0]?.toUpperCase() || null;
  }, [user]);

  const queryKey = ['contas-pagar', unidadeId, from, to];

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ContaPagar[]> => {
      if (!unidadeId) return [];
      const { data: rows, error } = await supabase
        .from('contas_pagar')
        .select('*')
        .eq('unidade_id', unidadeId)
        .is('deleted_at', null)
        .or(
          `and(data_vencimento.gte.${from},data_vencimento.lte.${to}),and(data_pagamento.gte.${from},data_pagamento.lte.${to})`,
        )
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return (rows || []) as unknown as ContaPagar[];
    },
    enabled: !!unidadeId,
  });

  const contas = useMemo(() => data || [], [data]);

  const kpis = useMemo(() => {
    const noPeriodoVenc = contas.filter(
      (c) => c.data_vencimento >= from && c.data_vencimento <= to && c.status !== 'cancelada',
    );
    const pagas = contas.filter(
      (c) => c.status === 'paga' && c.data_pagamento && c.data_pagamento >= from && c.data_pagamento <= to,
    );
    const vencendoHoje = noPeriodoVenc.filter((c) => computeStatus(c, hoje) === 'vencendo_hoje');
    const atrasadas = contas.filter((c) => computeStatus(c, hoje) === 'atrasada');

    const soma = (list: ContaPagar[], field: 'valor' | 'valor_pago') =>
      list.reduce((acc, c) => acc + Number(c[field] ?? 0), 0);

    return {
      totalMes: { valor: soma(noPeriodoVenc, 'valor'), qtd: noPeriodoVenc.length },
      vencendoHoje: { valor: soma(vencendoHoje, 'valor'), qtd: vencendoHoje.length },
      pagoPeriodo: { valor: soma(pagas, 'valor_pago'), qtd: pagas.length },
      atrasadas: { valor: soma(atrasadas, 'valor'), qtd: atrasadas.length },
    };
  }, [contas, from, to, hoje]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
  }, [queryClient]);

  const criarConta = useMutation({
    mutationFn: async (payload: ContaFormPayload) => {
      if (!unidadeId) throw new Error('Nenhuma unidade selecionada');
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { data: inserted, error } = await supabase
        .from('contas_pagar')
        .insert({
          ...payload,
          unidade_id: unidadeId,
          status: 'pendente',
          created_by: user.id,
          created_by_nome: userNome,
        } as never)
        .select('*')
        .single();
      if (error) throw error;
      const conta = inserted as unknown as ContaPagar;

      // Envio ao grupo financeiro: falha aqui NUNCA impede o cadastro.
      try {
        const { data: envio, error: envioErr } = await supabase.functions.invoke(
          'send-conta-pagar-whatsapp',
          { body: { conta_id: conta.id, tipo_envio: 'CADASTRO' } },
        );
        if (envioErr || (envio && envio.ok === false && !envio.skipped)) {
          toast({
            title: 'Conta cadastrada, mas o WhatsApp falhou',
            description:
              (envio?.erro as string | undefined) ||
              'A mensagem ficou na fila e será reenviada automaticamente.',
            variant: 'destructive',
          });
        } else if (envio?.ok) {
          toast({ title: 'Mensagem enviada ao grupo financeiro.' });
        }
      } catch {
        toast({
          title: 'Conta cadastrada, mas o WhatsApp falhou',
          description: 'A mensagem ficou na fila e será reenviada automaticamente.',
          variant: 'destructive',
        });
      }

      queryClient.invalidateQueries({ queryKey: ['contas-pagar-envios'] });
      return conta;
    },
    onSuccess: invalidate,
  });

  const reenviarWhatsapp = useMutation({
    mutationFn: async ({ contaId, tipo }: { contaId: string; tipo: 'CADASTRO' | 'VENCIMENTO' }) => {
      const { data, error } = await supabase.functions.invoke('send-conta-pagar-whatsapp', {
        body: { conta_id: contaId, tipo_envio: tipo, reenviar: true },
      });
      if (error) throw error;
      if (data?.ok !== true) throw new Error((data?.erro as string) || 'Não foi possível reenviar');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-envios'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-historico'] });
    },
  });

  const atualizarConta = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ContaFormPayload> }) => {
      const { error } = await supabase.from('contas_pagar').update(payload as never).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const darBaixa = useMutation({
    mutationFn: async (payload: BaixaPayload) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { id, ...rest } = payload;
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          ...rest,
          status: 'paga',
          baixado_por: user.id,
          baixado_por_nome: userNome,
          baixado_em: new Date().toISOString(),
        } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reabrirConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pendente',
          valor_pago: null,
          data_pagamento: null,
          forma_pagamento_baixa: null,
          juros: 0,
          multa: 0,
          desconto: 0,
          baixado_por: null,
          baixado_por_nome: null,
          baixado_em: null,
        } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const cancelarConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contas_pagar')
        .update({
          status: 'cancelada',
          cancelado_em: new Date().toISOString(),
          cancelado_por_nome: userNome,
        } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const excluirConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contas_pagar')
        .update({ deleted_at: new Date().toISOString() } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Busca contas semelhantes na mesma unidade (prevenção de duplicidade). */
  const buscarDuplicidade = useCallback(
    async (payload: {
      descricao: string;
      valor: number;
      data_vencimento: string;
      codigo_pix?: string | null;
      linha_digitavel?: string | null;
      numero_fatura?: string | null;
    }): Promise<ContaPagar[]> => {
      if (!unidadeId) return [];
      const encontrados = new Map<string, ContaPagar>();

      const { data: mesmoVenc } = await supabase
        .from('contas_pagar')
        .select('*')
        .eq('unidade_id', unidadeId)
        .is('deleted_at', null)
        .eq('data_vencimento', payload.data_vencimento)
        .eq('valor', payload.valor);

      ((mesmoVenc || []) as unknown as ContaPagar[]).forEach((c) => {
        const a = c.descricao.trim().toUpperCase();
        const b = payload.descricao.trim().toUpperCase();
        if (a === b || a.includes(b) || b.includes(a)) encontrados.set(c.id, c);
      });

      const chaves: string[] = [];
      if (payload.codigo_pix) chaves.push(`codigo_pix.eq.${payload.codigo_pix}`);
      if (payload.linha_digitavel) chaves.push(`linha_digitavel.eq.${payload.linha_digitavel}`);
      if (payload.numero_fatura) chaves.push(`numero_fatura.eq.${payload.numero_fatura}`);

      if (chaves.length) {
        const { data: porChave } = await supabase
          .from('contas_pagar')
          .select('*')
          .eq('unidade_id', unidadeId)
          .is('deleted_at', null)
          .or(chaves.join(','));
        ((porChave || []) as unknown as ContaPagar[]).forEach((c) => encontrados.set(c.id, c));
      }

      return Array.from(encontrados.values());
    },
    [unidadeId],
  );

  const statusDe = useCallback((conta: ContaPagar): ContaStatusView => computeStatus(conta, hoje), [hoje]);

  return {
    contas,
    isLoading,
    refetch,
    kpis,
    hoje,
    canManage,
    unidadeId,
    unidadeNome: unidadeAtual?.nome ?? '',
    statusDe,
    criarConta,
    atualizarConta,
    darBaixa,
    reabrirConta,
    cancelarConta,
    excluirConta,
    buscarDuplicidade,
    reenviarWhatsapp,
  };
}

export function useContaEnvios(contaId: string | null) {
  return useQuery({
    queryKey: ['contas-pagar-envios', contaId],
    queryFn: async (): Promise<ContaEnvio[]> => {
      if (!contaId) return [];
      const { data, error } = await supabase
        .from('contas_pagar_envios')
        .select('*')
        .eq('conta_id', contaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContaEnvio[];
    },
    enabled: !!contaId,
  });
}

export function useContaHistorico(contaId: string | null) {
  return useQuery({
    queryKey: ['contas-pagar-historico', contaId],
    queryFn: async (): Promise<ContaHistorico[]> => {
      if (!contaId) return [];
      const { data, error } = await supabase
        .from('contas_pagar_historico')
        .select('*')
        .eq('conta_id', contaId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContaHistorico[];
    },
    enabled: !!contaId,
  });
}

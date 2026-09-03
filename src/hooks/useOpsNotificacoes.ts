import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OpsNotificacao {
  id: string;
  usuario_id: string;
  atividade_id: string | null;
  execucao_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  lida: boolean;
  lido_em: string | null;
  created_at: string;
}

export function useOpsNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<OpsNotificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setNotificacoes([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('ops_notificacoes')
      .select('*')
      .eq('usuario_id', uid)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) console.error('Erro ao carregar notificações OPS:', error);
    setNotificacoes((data || []) as OpsNotificacao[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime: novas notificações do usuário
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('ops_notificacoes_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ops_notificacoes', filter: `usuario_id=eq.${userId}` },
        (payload) => {
          setNotificacoes((prev) => [payload.new as OpsNotificacao, ...prev]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const marcarLida = useCallback(async (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true, lido_em: new Date().toISOString() } : n)),
    );
    await supabase
      .from('ops_notificacoes')
      .update({ lida: true, lido_em: new Date().toISOString() })
      .eq('id', id);
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    if (!userId) return;
    const agora = new Date().toISOString();
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true, lido_em: n.lido_em ?? agora })));
    await supabase
      .from('ops_notificacoes')
      .update({ lida: true, lido_em: agora })
      .eq('usuario_id', userId)
      .eq('lida', false);
  }, [userId]);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  return { notificacoes, naoLidas, loading, refetch: fetch, marcarLida, marcarTodasLidas };
}

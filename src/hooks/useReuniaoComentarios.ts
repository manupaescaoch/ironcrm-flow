import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ReuniaoComentario {
  id: string;
  reuniao_id: string;
  unidade_id: string;
  autor_id: string;
  autor_nome: string;
  conteudo: string;
  created_at: string;
  updated_at: string;
}

export function useReuniaoComentarios(reuniaoId: string | null, unidadeId: string | null) {
  const [comentarios, setComentarios] = useState<ReuniaoComentario[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const fetch = useCallback(async () => {
    if (!reuniaoId) {
      setComentarios([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reuniao_comentarios' as any)
        .select('*')
        .eq('reuniao_id', reuniaoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setComentarios((data || []) as unknown as ReuniaoComentario[]);
    } catch (err: any) {
      console.error('Erro ao buscar comentários:', err);
      toast({ title: 'Erro ao carregar comentários', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [reuniaoId]);

  useEffect(() => { fetch(); }, [fetch]);

  const adicionar = useCallback(async (texto: string) => {
    if (!reuniaoId || !unidadeId) return;
    const conteudo = texto.trim();
    if (!conteudo) return;
    setSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Usuário não autenticado');
      const autor_nome =
        (userData.user?.user_metadata as any)?.full_name ||
        (userData.user?.user_metadata as any)?.name ||
        userData.user?.email ||
        'USUÁRIO';

      const { error } = await supabase.from('reuniao_comentarios' as any).insert({
        reuniao_id: reuniaoId,
        unidade_id: unidadeId,
        autor_id: uid,
        autor_nome,
        conteudo,
      } as any);
      if (error) throw error;
      await fetch();
    } catch (err: any) {
      toast({ title: 'Erro ao comentar', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }, [reuniaoId, unidadeId, fetch]);

  const editar = useCallback(async (id: string, texto: string) => {
    const conteudo = texto.trim();
    if (!conteudo) return;
    try {
      const { error } = await supabase
        .from('reuniao_comentarios' as any)
        .update({ conteudo } as any)
        .eq('id', id);
      if (error) throw error;
      await fetch();
    } catch (err: any) {
      toast({ title: 'Erro ao editar', description: err.message, variant: 'destructive' });
    }
  }, [fetch]);

  const remover = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('reuniao_comentarios' as any).delete().eq('id', id);
      if (error) throw error;
      await fetch();
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  }, [fetch]);

  return { comentarios, loading, sending, adicionar, editar, remover, refetch: fetch };
}

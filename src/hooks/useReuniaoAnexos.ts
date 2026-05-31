import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface ReuniaoAnexo {
  id: string;
  reuniao_id: string;
  unidade_id: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

const BUCKET = 'reuniao-anexos';

export function useReuniaoAnexos(reuniaoId: string | null, unidadeId: string | null) {
  const [anexos, setAnexos] = useState<ReuniaoAnexo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAnexos = useCallback(async () => {
    if (!reuniaoId) {
      setAnexos([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reuniao_anexos' as any)
        .select('*')
        .eq('reuniao_id', reuniaoId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnexos((data || []) as unknown as ReuniaoAnexo[]);
    } catch (err: any) {
      console.error('Erro ao buscar anexos:', err);
      toast({ title: 'Erro ao carregar anexos', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [reuniaoId]);

  useEffect(() => { fetchAnexos(); }, [fetchAnexos]);

  const uploadAnexo = useCallback(async (file: File) => {
    if (!reuniaoId || !unidadeId) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Somente PDF é permitido', variant: 'destructive' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Limite de 15MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      const path = `${reuniaoId}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (upErr) throw upErr;

      const userName =
        (userData.user?.user_metadata as any)?.full_name ||
        (userData.user?.user_metadata as any)?.name ||
        userData.user?.email ||
        null;

      const { error: insErr } = await supabase.from('reuniao_anexos' as any).insert({
        reuniao_id: reuniaoId,
        unidade_id: unidadeId,
        file_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: userData.user?.id ?? null,
        uploaded_by_name: userName,
      } as any);
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
      toast({ title: 'PDF anexado' });
      await fetchAnexos();
    } catch (err: any) {
      toast({ title: 'Erro ao anexar PDF', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [reuniaoId, unidadeId, fetchAnexos]);

  const downloadAnexo = useCallback(async (a: ReuniaoAnexo) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.file_path, 60);
    if (error || !data) {
      toast({ title: 'Erro ao gerar link', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const deleteAnexo = useCallback(async (a: ReuniaoAnexo) => {
    try {
      const { error: delDb } = await supabase.from('reuniao_anexos' as any).delete().eq('id', a.id);
      if (delDb) throw delDb;
      await supabase.storage.from(BUCKET).remove([a.file_path]);
      toast({ title: 'Anexo removido' });
      await fetchAnexos();
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    }
  }, [fetchAnexos]);

  return { anexos, loading, uploading, uploadAnexo, downloadAnexo, deleteAnexo, refetch: fetchAnexos };
}

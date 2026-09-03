import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type OpsStatus = 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';

export interface OpsExecucao {
  id: string;
  atividade_id: string;
  unidade_id: string;
  data_execucao: string;
  status: OpsStatus;
  iniciado_em: string | null;
  iniciado_por: string | null;
  concluido_em: string | null;
  concluido_por: string | null;
  cancelado_em: string | null;
  cancelado_por: string | null;
  motivo_cancelamento: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsComentario {
  id: string;
  atividade_id: string;
  execucao_id: string | null;
  usuario_id: string;
  usuario_nome: string | null;
  comentario: string;
  created_at: string;
}

export interface OpsAnexo {
  id: string;
  atividade_id: string;
  execucao_id: string | null;
  usuario_id: string;
  arquivo_url: string;
  nome_arquivo: string | null;
  tipo: string | null;
  created_at: string;
}

export const OPS_EVIDENCIA_BUCKET = 'ops-evidencias';
const MAX_EVIDENCIA_BYTES = 15 * 1024 * 1024;

/** Data local no formato yyyy-mm-dd (sem deslocamento de fuso). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) throw new Error('Usuário não autenticado');
  const nome =
    (user.user_metadata as any)?.full_name ||
    (user.user_metadata as any)?.name ||
    user.email ||
    null;
  return { id: user.id, nome };
}

interface UseOpsExecucaoArgs {
  atividadeId: string | null;
  unidadeId: string | null;
  data: string | null;
  exigeEvidencia?: boolean;
  exigeConfirmacao?: boolean;
}

export function useOpsExecucao({ atividadeId, unidadeId, data, exigeEvidencia, exigeConfirmacao }: UseOpsExecucaoArgs) {
  const [execucao, setExecucao] = useState<OpsExecucao | null>(null);
  const [comentarios, setComentarios] = useState<OpsComentario[]>([]);
  const [anexos, setAnexos] = useState<OpsAnexo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!atividadeId || !data) {
      setExecucao(null);
      setComentarios([]);
      setAnexos([]);
      return;
    }
    setLoading(true);
    try {
      const [execRes, comRes, anexRes] = await Promise.all([
        supabase
          .from('ops_execucoes')
          .select('*')
          .eq('atividade_id', atividadeId)
          .eq('data_execucao', data)
          .maybeSingle(),
        supabase
          .from('ops_comentarios')
          .select('*')
          .eq('atividade_id', atividadeId)
          .order('created_at', { ascending: true }),
        supabase
          .from('ops_anexos')
          .select('*')
          .eq('atividade_id', atividadeId)
          .order('created_at', { ascending: false }),
      ]);
      if (execRes.error) throw execRes.error;
      if (comRes.error) throw comRes.error;
      if (anexRes.error) throw anexRes.error;
      setExecucao((execRes.data as unknown as OpsExecucao) || null);
      setComentarios((comRes.data || []) as unknown as OpsComentario[]);
      setAnexos((anexRes.data || []) as unknown as OpsAnexo[]);
    } catch (err: any) {
      console.error('Erro ao carregar execução:', err);
      toast({ title: 'Erro ao carregar execução', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [atividadeId, data]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertExecucao = useCallback(async (patch: Partial<OpsExecucao>) => {
    if (!atividadeId || !unidadeId || !data) throw new Error('Atividade sem unidade ou data');
    if (execucao) {
      const { data: row, error } = await supabase
        .from('ops_execucoes')
        .update(patch as any)
        .eq('id', execucao.id)
        .select('*')
        .single();
      if (error) throw error;
      return row as unknown as OpsExecucao;
    }
    const { data: row, error } = await supabase
      .from('ops_execucoes')
      .insert({
        atividade_id: atividadeId,
        unidade_id: unidadeId,
        data_execucao: data,
        ...patch,
      } as any)
      .select('*')
      .single();
    if (error) throw error;
    return row as unknown as OpsExecucao;
  }, [atividadeId, unidadeId, data, execucao]);

  const iniciar = useCallback(async () => {
    setSaving(true);
    try {
      const row = await upsertExecucao({ status: 'em_andamento' });
      setExecucao(row);
      toast({ title: 'Atividade iniciada' });
    } catch (err: any) {
      toast({ title: 'Erro ao iniciar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [upsertExecucao]);

  const concluir = useCallback(async ({ observacao, confirmado }: { observacao?: string; confirmado?: boolean } = {}) => {
    if (exigeEvidencia && anexos.length === 0) {
      toast({
        title: 'Evidência obrigatória',
        description: 'Anexe uma evidência antes de concluir esta atividade.',
        variant: 'destructive',
      });
      return false;
    }
    if (exigeConfirmacao && !confirmado) {
      toast({
        title: 'Confirmação obrigatória',
        description: 'Marque a confirmação de execução antes de concluir.',
        variant: 'destructive',
      });
      return false;
    }
    setSaving(true);
    try {
      const row = await upsertExecucao({
        status: 'concluida',
        observacao: observacao?.trim() ? observacao.trim() : execucao?.observacao ?? null,
      });
      setExecucao(row);
      toast({ title: 'Atividade concluída' });
      return true;
    } catch (err: any) {
      toast({ title: 'Erro ao concluir', description: err.message, variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [upsertExecucao, anexos.length, exigeEvidencia, exigeConfirmacao, execucao]);

  const reabrir = useCallback(async () => {
    setSaving(true);
    try {
      const row = await upsertExecucao({ status: 'em_andamento', concluido_em: null, concluido_por: null });
      setExecucao(row);
      toast({ title: 'Execução reaberta' });
    } catch (err: any) {
      toast({ title: 'Erro ao reabrir', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [upsertExecucao]);

  const salvarObservacao = useCallback(async (observacao: string) => {
    setSaving(true);
    try {
      const row = await upsertExecucao({ observacao: observacao.trim() || null });
      setExecucao(row);
      toast({ title: 'Observação salva' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar observação', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [upsertExecucao]);

  const comentar = useCallback(async (texto: string) => {
    const comentario = texto.trim();
    if (!comentario || !atividadeId) return;
    try {
      const user = await currentUser();
      const { error } = await supabase.from('ops_comentarios').insert({
        atividade_id: atividadeId,
        execucao_id: execucao?.id ?? null,
        usuario_id: user.id,
        usuario_nome: user.nome,
        comentario,
      } as any);
      if (error) throw error;
      await fetchAll();
    } catch (err: any) {
      toast({ title: 'Erro ao comentar', description: err.message, variant: 'destructive' });
    }
  }, [atividadeId, execucao, fetchAll]);

  const anexarEvidencia = useCallback(async (file: File) => {
    if (!atividadeId || !unidadeId || !data) return;
    if (file.size > MAX_EVIDENCIA_BYTES) {
      toast({ title: 'Arquivo muito grande', description: 'Limite de 15MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    let path: string | null = null;
    try {
      const user = await currentUser();
      // Garante execução do dia para vincular a evidência.
      let exec = execucao;
      if (!exec) {
        exec = await upsertExecucao({ status: 'em_andamento' });
        setExecucao(exec);
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, '_');
      path = `${atividadeId}/${data}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from(OPS_EVIDENCIA_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from('ops_anexos').insert({
        atividade_id: atividadeId,
        execucao_id: exec?.id ?? null,
        usuario_id: user.id,
        arquivo_url: path,
        nome_arquivo: file.name,
        tipo: file.type || null,
      } as any);
      if (insErr) throw insErr;
      toast({ title: 'Evidência anexada' });
      await fetchAll();
    } catch (err: any) {
      if (path) await supabase.storage.from(OPS_EVIDENCIA_BUCKET).remove([path]);
      toast({ title: 'Erro ao anexar evidência', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }, [atividadeId, unidadeId, data, execucao, upsertExecucao, fetchAll]);

  const abrirEvidencia = useCallback(async (anexo: OpsAnexo) => {
    const { data: signed, error } = await supabase.storage
      .from(OPS_EVIDENCIA_BUCKET)
      .createSignedUrl(anexo.arquivo_url, 60);
    if (error || !signed) {
      toast({ title: 'Erro ao gerar link', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(signed.signedUrl, '_blank', 'noopener,noreferrer');
  }, []);

  return {
    execucao,
    comentarios,
    anexos,
    loading,
    saving,
    uploading,
    status: (execucao?.status ?? 'pendente') as OpsStatus,
    iniciar,
    concluir,
    reabrir,
    salvarObservacao,
    comentar,
    anexarEvidencia,
    abrirEvidencia,
    refetch: fetchAll,
  };
}

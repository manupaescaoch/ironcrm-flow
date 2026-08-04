import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'contas-pagar-docs';

/** Faz upload de um anexo dentro da pasta da unidade (acesso validado no backend). */
export async function uploadContaArquivo(
  file: File,
  unidadeId: string,
  subpasta: 'documentos' | 'comprovantes',
): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]/g, '_');
  const path = `${unidadeId}/${subpasta}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

/** Gera uma URL temporária para visualizar um anexo privado. */
export async function getContaArquivoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

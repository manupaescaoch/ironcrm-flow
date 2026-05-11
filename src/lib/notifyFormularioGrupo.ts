import { supabase } from '@/integrations/supabase/client';

export type FormularioKey =
  | 'estagiario_lider'
  | 'coordenador_unidade'
  | 'coordenador_horario'
  | 'relatorio_comercial';

interface NotifyArgs {
  formulario_key: FormularioKey;
  unidade: string;
  titulo: string;
  items: { label: string; value: string }[];
}

export async function notifyFormularioGrupo({ formulario_key, unidade, titulo, items }: NotifyArgs) {
  try {
    const filtered = items.filter(
      (it) => it.value && String(it.value).trim() !== '' && it.value !== '—',
    );
    if (filtered.length === 0) return;
    await supabase.functions.invoke('notify-formulario-encerramento', {
      body: { formulario_key, unidade, titulo, items: filtered },
    });
  } catch (e) {
    console.warn('[notifyFormularioGrupo] falha (ignorada)', e);
  }
}

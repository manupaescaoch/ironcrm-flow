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
      (it) => it.value && it.value.trim() !== '' && it.value !== '—',
    );
    const resumo = filtered.map((it) => `*${it.label}:* ${it.value}`).join('\n');
    if (!resumo) return;
    await supabase.functions.invoke('notify-formulario-encerramento', {
      body: { formulario_key, unidade, titulo, resumo },
    });
  } catch (e) {
    console.warn('[notifyFormularioGrupo] falha (ignorada)', e);
  }
}

import { supabase } from '@/integrations/supabase/client';

export type TipoFormulario =
  | 'estagiario_lider'
  | 'coordenador_unidade'
  | 'coordenador_horario'
  | 'relatorio_comercial';

/**
 * Fluxo PÚBLICO — usado pelas páginas /encerramento-* e /relatorio-diario-comercial,
 * que rodam sem usuário autenticado.
 *
 * A página primeiro insere a resposta na tabela canônica (`encerramento_*_respostas`
 * ou `relatorio_diario_comercial_respostas`) via RLS pública e depois passa apenas
 * o `resposta_id` para o servidor. O servidor carrega a fonte canônica do banco,
 * monta a mensagem por template e envia ao grupo configurado. O frontend não
 * controla título, corpo, destino ou template.
 */
export async function submitFormularioPublico(args: {
  tipo_formulario: TipoFormulario;
  unidade: string;
  resposta_id: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke('submit-formulario-publico', {
      body: {
        tipo_formulario: args.tipo_formulario,
        unidade: args.unidade,
        resposta_id: args.resposta_id,
      },
    });
  } catch (e) {
    console.warn('[submitFormularioPublico] falha (ignorada)', e);
  }
}

/**
 * Fluxo CRM AUTENTICADO — usado pelo botão "Testar" em /admin/grupos-whatsapp.
 * Envia uma mensagem de TESTE fixa montada pelo servidor. O caller não consegue
 * injetar conteúdo no corpo da mensagem.
 */
export async function notifyFormularioGrupoAuth(args: {
  tipo_formulario: TipoFormulario;
  unidade: string;
  unidade_id?: string | null;
}) {
  return supabase.functions.invoke('notify-formulario-encerramento', {
    body: {
      tipo_formulario: args.tipo_formulario,
      unidade: args.unidade,
      unidade_id: args.unidade_id ?? null,
      mode: 'test',
    },
  });
}

// ---------------------------------------------------------------------------
// Compatibilidade temporária: a assinatura antiga aceitava `formulario_key`,
// `titulo` e `items`. Esses parâmetros são IGNORADOS pelo servidor agora — só
// mantemos a função exportada para evitar quebrar imports legados durante a
// migração. NÃO use em código novo. Use `submitFormularioPublico` quando o
// resposta_id estiver disponível.
// ---------------------------------------------------------------------------
export type FormularioKey = TipoFormulario;
export async function notifyFormularioGrupo(_args: {
  formulario_key: FormularioKey;
  unidade: string;
  titulo: string;
  items: { label: string; value: string }[];
}): Promise<void> {
  console.warn(
    '[notifyFormularioGrupo] DEPRECATED: payload livre não é mais aceito. Use submitFormularioPublico.',
  );
}

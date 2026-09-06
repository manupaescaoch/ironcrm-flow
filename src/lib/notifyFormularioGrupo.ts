import { supabase } from '@/integrations/supabase/client';

export type TipoFormulario =
  | 'estagiario_lider'
  | 'coordenador_unidade'
  | 'coordenador_horario'
  | 'relatorio_comercial'
  | 'coordenador_tecnico';

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
  unidade_id?: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke('submit-formulario-publico', {
      body: {
        tipo_formulario: args.tipo_formulario,
        unidade: args.unidade,
        resposta_id: args.resposta_id,
        unidade_id: args.unidade_id,
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


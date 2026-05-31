// submit-formulario-publico
//
// Entrypoint público para os formulários operacionais (encerramento de turno,
// coordenador, horário, relatório comercial). É chamado pelas páginas
// /encerramento-* logo após o INSERT da linha na tabela canônica
// `*_respostas`.
//
// Princípios:
// - O payload NÃO contém título nem corpo da mensagem.
// - O servidor carrega a fonte canônica da resposta diretamente do banco usando
//   o `resposta_id`.
// - A linha precisa ser fresca (criada nos últimos 10 minutos), prevenindo
//   replays a partir de IDs antigos.
// - Não recebe nem expõe group_id, telefone ou template.
// - Idempotência, rate limit, sanitização e auditoria acontecem dentro de
//   `executeNotification`.

import { z } from 'https://esm.sh/zod@3.23.8';
import {
  TIPOS_FORMULARIO,
  type TipoFormulario,
  validateUnidade,
  loadCanonicalRow,
  getServiceClient,
} from '../_shared/notifyFormularioCore.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PayloadSchema = z
  .object({
    tipo_formulario: z.enum(TIPOS_FORMULARIO as unknown as [string, ...string[]]),
    unidade: z.string().min(1).max(50),
    resposta_id: z.string().uuid(),
  })
  .strict();

function jsonResp(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResp(405, { error: 'Método não permitido.' });

  try {
    const raw = await req.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) return jsonResp(400, { error: 'Dados inválidos.' });

    const { tipo_formulario, resposta_id } = parsed.data;
    const unidade = validateUnidade(parsed.data.unidade);
    if (!unidade) return jsonResp(400, { error: 'Unidade inválida.' });

    // 1. Load the canonical row from DB (service role, freshness-checked)
    const svc = getServiceClient();
    const { row, reason } = await loadCanonicalRow(
      svc,
      tipo_formulario as TipoFormulario,
      resposta_id,
    );
    if (!row) {
      // Generic message: do not leak whether the row exists or is stale.
      return jsonResp(400, { error: 'Resposta não pôde ser confirmada.' });
    }

    // 2. Verify the canonical row's unidade matches the requested unidade.
    const rowUnidade = typeof row.unidade === 'string' ? row.unidade.toUpperCase().trim() : '';
    if (rowUnidade !== unidade) {
      return jsonResp(400, { error: 'Resposta não pôde ser confirmada.' });
    }

    // 3. Forward to notify-formulario-encerramento with the canonical row.
    const internalSecret = Deno.env.get('INTERNAL_NOTIFY_SECRET');
    if (!internalSecret) {
      console.error('[submit-formulario-publico] INTERNAL_NOTIFY_SECRET missing');
      return jsonResp(500, { error: 'Erro interno.' });
    }
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-formulario-encerramento`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-call': internalSecret,
        'x-cron-secret': Deno.env.get('BACKUP_CRON_SECRET') ?? '',
        // Authorization is required by the platform router; use anon key.
        Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        tipo_formulario,
        unidade,
        resposta_id,
        row,
      }),
    });
    const text = await resp.text();
    let result: Record<string, unknown> = {};
    try { result = JSON.parse(text); } catch { /* ignore */ }
    return jsonResp(resp.status, result);
  } catch (e) {
    console.error('[submit-formulario-publico] error', e);
    return jsonResp(500, { error: 'Erro interno ao processar a solicitação.' });
  }
});

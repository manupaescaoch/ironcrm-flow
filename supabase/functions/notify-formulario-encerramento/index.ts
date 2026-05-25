// notify-formulario-encerramento
//
// Entrypoint para o CRM autenticado (admin e futuros usos).
// Para o fluxo público dos formulários operacionais, use `submit-formulario-publico`.
//
// Modos aceitos:
//  - JWT do usuário (Bearer): valida via Supabase Auth, exige role admin/coordenador/user
//    com acesso à unidade.
//  - Chamada interna a partir de submit-formulario-publico: header
//    `x-internal-call` com valor do secret INTERNAL_NOTIFY_SECRET.
//
// O caller envia apenas { tipo_formulario, unidade, fields }. O servidor monta
// o título e o corpo da mensagem por template. Idempotência, rate limit, destino
// de grupo e auditoria são todos resolvidos no servidor.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import {
  TIPOS_FORMULARIO,
  type TipoFormulario,
  validateUnidade,
  executeNotification,
} from '../_shared/notifyFormularioCore.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-call',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const FieldsSchema = z
  .record(z.string().min(1).max(80), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
  .refine((obj) => Object.keys(obj).length <= 50, { message: 'Too many fields' });

const PayloadSchema = z
  .object({
    tipo_formulario: z.enum(TIPOS_FORMULARIO as unknown as [string, ...string[]]),
    unidade: z.string().min(1).max(50),
    unidade_id: z.string().uuid().optional().nullable(),
    resposta_id: z.string().uuid().optional().nullable(),
    fields: FieldsSchema,
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
    // ---------- Authn/Authz ----------
    const internalHeader = req.headers.get('x-internal-call') || '';
    const internalSecret = Deno.env.get('INTERNAL_NOTIFY_SECRET') || '';
    const isInternalCall =
      !!internalSecret && !!internalHeader && timingSafeEqual(internalHeader, internalSecret);

    let requestedBy: string | null = null;
    let isAdmin = false;
    let userUnidadeIds: string[] = [];

    if (!isInternalCall) {
      const authHeader = req.headers.get('Authorization') || '';
      if (!authHeader.startsWith('Bearer ')) {
        return jsonResp(401, { error: 'Não autenticado.' });
      }
      const token = authHeader.replace('Bearer ', '');
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
      );
      const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return jsonResp(401, { error: 'Não autenticado.' });
      }
      requestedBy = claimsData.claims.sub as string;

      const svc = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', requestedBy);
      if (!roles || roles.length === 0) {
        return jsonResp(403, { error: 'Sem permissão.' });
      }
      const roleSet = new Set(roles.map((r: { role: string }) => r.role));
      isAdmin = roleSet.has('admin');
      const allowedRoles = ['admin', 'coordenador', 'user', 'moderator'];
      if (!Array.from(roleSet).some((r) => allowedRoles.includes(r))) {
        return jsonResp(403, { error: 'Sem permissão.' });
      }
      if (!isAdmin) {
        const { data: uns } = await svc
          .from('user_unidades')
          .select('unidade_id')
          .eq('user_id', requestedBy);
        userUnidadeIds = (uns || []).map((u: { unidade_id: string }) => u.unidade_id);
      }
    }

    // ---------- Schema validation ----------
    const raw = await req.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResp(400, { error: 'Dados inválidos.' });
    }
    const { tipo_formulario, fields } = parsed.data;
    const unidade = validateUnidade(parsed.data.unidade);
    if (!unidade) return jsonResp(400, { error: 'Unidade inválida.' });

    // ---------- Authz: unidade scope ----------
    if (!isInternalCall && !isAdmin) {
      if (!parsed.data.unidade_id) {
        return jsonResp(403, { error: 'Unidade não autorizada.' });
      }
      if (!userUnidadeIds.includes(parsed.data.unidade_id)) {
        return jsonResp(403, { error: 'Unidade não autorizada.' });
      }
    }

    // ---------- Execute ----------
    const result = await executeNotification(
      {
        tipo_formulario: tipo_formulario as TipoFormulario,
        unidade,
        unidade_id: parsed.data.unidade_id ?? null,
        resposta_id: parsed.data.resposta_id ?? null,
        requested_by: requestedBy,
        origem: isInternalCall ? 'public_form' : 'crm_auth',
      },
      fields as Record<string, unknown>,
    );
    return jsonResp(result.status, result.body);
  } catch (e) {
    console.error('[notify-formulario-encerramento] error', e);
    return jsonResp(500, { error: 'Erro interno ao processar a solicitação.' });
  }
});

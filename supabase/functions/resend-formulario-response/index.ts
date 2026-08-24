// One-shot admin utility: resend a specific form response to its WhatsApp group.
// Requires the caller's Supabase JWT to belong to an admin.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'npm:zod@3.23.8';
import {
  executeNotification,
  validateUnidade,
  type TipoFormulario,
} from '../_shared/notifyFormularioCore.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLE_BY_TIPO: Record<TipoFormulario, string> = {
  estagiario_lider: 'encerramento_turno_respostas',
  coordenador_unidade: 'encerramento_coordenador_respostas',
  coordenador_horario: 'encerramento_horario_respostas',
  relatorio_comercial: 'relatorio_diario_comercial_respostas',
};

// Validação por schema da entrada (mesmos códigos de erro do contrato atual).
const ItemSchema = z.object({
  tipo_formulario: z.enum([
    'estagiario_lider',
    'coordenador_unidade',
    'coordenador_horario',
    'relatorio_comercial',
  ]),
  resposta_id: z.string().uuid(),
});
const BodySchema = z.object({ items: z.array(ItemSchema).min(1).max(50) }).passthrough();


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'unauth' }), { status: 401, headers: corsHeaders });
  }
  const token = authHeader.replace('Bearer ', '');

  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: claims } = await anon.auth.getClaims(token);
  const uid = claims?.claims?.sub as string | undefined;
  if (!uid) {
    return new Response(JSON.stringify({ error: 'unauth' }), { status: 401, headers: corsHeaders });
  }

  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roles } = await svc.from('user_roles').select('role').eq('user_id', uid);
  const isAdmin = (roles || []).some((r: { role: string }) => r.role === 'admin');
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: corsHeaders });
  }

  const rawBody = await req.json().catch(() => null);
  const rawItems = (rawBody as any)?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return new Response(JSON.stringify({ error: 'no_items' }), { status: 400, headers: corsHeaders });
  }
  if (rawItems.length > 50) {
    return new Response(JSON.stringify({ error: 'too_many_items' }), { status: 400, headers: corsHeaders });
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'resposta_id inválido' }), { status: 400, headers: corsHeaders });
  }
  const items: Array<{ tipo_formulario: TipoFormulario; resposta_id: string }> = parsed.data.items;



  const results: unknown[] = [];
  for (const it of items) {
    const table = TABLE_BY_TIPO[it.tipo_formulario];
    if (!table) {
      results.push({ ...it, ok: false, reason: 'invalid_tipo' });
      continue;
    }
    const { data: row, error } = await svc.from(table).select('*').eq('id', it.resposta_id).maybeSingle();
    if (error || !row) {
      results.push({ ...it, ok: false, reason: 'row_not_found' });
      continue;
    }
    const unidade = validateUnidade(String((row as any).unidade || ''));
    if (!unidade) {
      results.push({ ...it, ok: false, reason: 'invalid_unidade' });
      continue;
    }
    const res = await executeNotification(
      {
        tipo_formulario: it.tipo_formulario,
        unidade,
        unidade_id: (row as any).unidade_id ?? null,
        resposta_id: it.resposta_id,
        requested_by: uid,
        origem: 'admin_resend',
      },
      row as Record<string, unknown>,
    );
    results.push({ ...it, status: res.status, body: res.body });
    await new Promise((r) => setTimeout(r, 800));
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

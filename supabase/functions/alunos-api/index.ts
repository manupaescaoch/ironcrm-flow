// API pública de LEITURA dos alunos (somente GET), protegida por chave secreta.
// Nenhuma escrita é possível: usa apenas select() e rejeita métodos != GET.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-api-key, authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

  const expected = Deno.env.get('ALUNOS_API_KEY');
  if (!expected || expected.length < 16) {
    return json({ error: 'Server misconfigured' }, 500);
  }

  const provided =
    req.headers.get('x-api-key') ??
    (req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '');
  if (!provided || !constantTimeEqual(provided, expected)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '200') || 200, 1), 1000);
  const offset = Math.max(Number(url.searchParams.get('offset') ?? '0') || 0, 0);
  const unidadeParam = url.searchParams.get('unidade_id');
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (unidadeParam && !uuidRe.test(unidadeParam)) {
    return json({ error: 'unidade_id inválido' }, 400);
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    let query = supabase
      .from('leads')
      .select('id, nome, telefone, ativo, unidade_id, unidades(nome)', { count: 'exact' })
      .eq('is_matriculado', true)
      .order('nome', { ascending: true })
      .range(offset, offset + limit - 1);

    if (unidadeParam) query = query.eq('unidade_id', unidadeParam);

    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 500);

    const alunos = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nome: (r.nome as string) ?? null,
      telefone: (r.telefone as string) ?? null,
      status: r.ativo ? 'ativo' : 'inativo',
      unidade: r.unidade_id
        ? { id: r.unidade_id as string, nome: (r.unidades as { nome?: string } | null)?.nome ?? null }
        : null,
    }));

    return json({ total: count ?? alunos.length, limit, offset, alunos });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});

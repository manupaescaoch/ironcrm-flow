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

  const truthy = (v: string | null) => v === '1' || v === 'true' || v === 'sim';
  const incluirAnamnese = truthy(url.searchParams.get('incluir_anamnese'));
  const incluirNaoMatriculados = truthy(url.searchParams.get('incluir_nao_matriculados'));


  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    let query = supabase
      .from('leads')
      .select('id, nome, telefone, ativo, is_matriculado, unidade_id, unidades(nome)', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(offset, offset + limit - 1);

    if (!incluirNaoMatriculados) query = query.eq('is_matriculado', true);
    if (unidadeParam) query = query.eq('unidade_id', unidadeParam);

    const { data, error, count } = await query;
    if (error) return json({ error: error.message }, 500);

    const rows = data ?? [];

    // Anamnese: buscada apenas para os leads desta página (no máximo 1000 ids)
    const anamnesePorLead = new Map<string, Record<string, unknown>>();
    if (incluirAnamnese && rows.length > 0) {
      const ids = rows.map((r: Record<string, unknown>) => r.id as string);
      const CHUNK = 100;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const { data: anamneses, error: anamneseError } = await supabase
          .from('anamneses_experimental')
          .select(
            'lead_id, nome, data_nascimento, objetivo, historico, frequencia_atual, obstaculo, dias_semana, preferencia_horario, tem_condicao_saude, condicao_saude_descricao, tem_lesao, lesao_descricao, observacoes, created_at',
          )
          .in('lead_id', ids.slice(i, i + CHUNK))
          .order('created_at', { ascending: true });
        if (anamneseError) return json({ error: anamneseError.message }, 500);
        for (const a of anamneses ?? []) {
          const leadId = (a as Record<string, unknown>).lead_id as string | null;
          if (leadId) anamnesePorLead.set(leadId, a as Record<string, unknown>);
        }
      }
    }


    const alunos = rows.map((r: Record<string, unknown>) => {
      const base: Record<string, unknown> = {
        id: r.id as string,
        nome: (r.nome as string) ?? null,
        telefone: (r.telefone as string) ?? null,
        status: r.ativo ? 'ativo' : 'inativo',
        matriculado: r.is_matriculado === true,
        unidade: r.unidade_id
          ? { id: r.unidade_id as string, nome: (r.unidades as { nome?: string } | null)?.nome ?? null }
          : null,
      };
      if (incluirAnamnese) {
        const a = anamnesePorLead.get(r.id as string);
        base.anamnese = a
          ? {
              respondida_em: a.created_at ?? null,
              nome: a.nome ?? null,
              data_nascimento: a.data_nascimento ?? null,
              objetivo: a.objetivo ?? null,
              historico: a.historico ?? null,
              frequencia_atual: a.frequencia_atual ?? null,
              obstaculo: a.obstaculo ?? null,
              dias_semana: a.dias_semana ?? null,
              preferencia_horario: a.preferencia_horario ?? null,
              tem_condicao_saude: a.tem_condicao_saude ?? null,
              condicao_saude_descricao: a.condicao_saude_descricao ?? null,
              tem_lesao: a.tem_lesao ?? null,
              lesao_descricao: a.lesao_descricao ?? null,
              observacoes: a.observacoes ?? null,
            }
          : null;
      }
      return base;
    });

    return json({ total: count ?? alunos.length, limit, offset, alunos });

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Internal error' }, 500);
  }
});

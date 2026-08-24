import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const UNIDADES: Record<string, string> = {
  madalena: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6',
  boa_viagem: 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
  setubal: '00000000-0000-0000-0000-000000000000',
}

const PAGE = 1000

const COLS = [
  'id',
  'unidade_id',
  'descricao',
  'fornecedor',
  'categoria',
  'prioridade',
  'centro_custo',
  'competencia',
  'observacoes',
  'valor',
  'data_vencimento',
  'forma_pagamento',
  'numero_fatura',
  'status',
  'valor_pago',
  'data_pagamento',
  'forma_pagamento_baixa',
  'juros',
  'multa',
  'desconto',
  'baixa_observacoes',
  'baixado_por_nome',
  'baixado_em',
  'cancelado_em',
  'created_by_nome',
  'created_at',
  'updated_at',
  'banco',
  'agencia',
  'conta_bancaria',
  'favorecido',
  'link_pagamento',
]

const SELECT = [...COLS, 'documento_url', 'comprovante_url'].join(', ')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

async function fetchAll<T = any>(build: () => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('EVO_PAINEL_TOKEN')
  const token = req.headers.get('x-evo-token')
  if (!secret || !token || token !== secret) return json({ error: 'unauthorized' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const unidadeKey: string = body?.unidade || 'consolidado'
    if (unidadeKey !== 'consolidado' && !UNIDADES[unidadeKey]) {
      return json({ error: 'unidade inválida' }, 400)
    }
    const ids =
      unidadeKey === 'consolidado'
        ? Object.values(UNIDADES)
        : [UNIDADES[unidadeKey]]

    let desde: string | null = null
    if (body?.atualizadas_desde) {
      const d = new Date(String(body.atualizadas_desde))
      if (Number.isNaN(d.getTime())) {
        return json({ error: 'atualizadas_desde inválido (use ISO 8601)' }, 400)
      }
      desde = d.toISOString()
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const base = (select: string) => {
      let q = supabase.from('contas_pagar').select(select).in('unidade_id', ids)
      if (desde) q = q.gt('updated_at', desde)
      return q
    }

    const rows = await fetchAll<any>(() =>
      base(SELECT).is('deleted_at', null).order('updated_at', { ascending: true }),
    )

    const contas = rows.map((r) => {
      const out: Record<string, unknown> = {}
      for (const c of COLS) out[c] = r[c] ?? null
      out.documento_presente = Boolean(r.documento_url)
      out.comprovante_presente = Boolean(r.comprovante_url)
      return out
    })

    const removidosRows = await fetchAll<any>(() =>
      base('id, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: true }),
    )
    const removidos = removidosRows.map((r) => ({ id: r.id, deleted_at: r.deleted_at }))

    return json({
      unidade: unidadeKey,
      atualizadas_desde: desde,
      total: contas.length,
      contas,
      removidos,
      total_removidos: removidos.length,
      atualizado_em: new Date().toISOString(),
    })
  } catch (e) {
    const err = e as { message?: string; details?: string; hint?: string; code?: string }
    return json(
      {
        error: err?.message || String(e),
        details: err?.details ?? null,
        hint: err?.hint ?? null,
        code: err?.code ?? null,
      },
      500,
    )
  }
})

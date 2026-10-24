// Acesso do EVO OS ao Contas a Pagar: listar, ver arquivos (links temporários) e editar.
// Autenticação: header x-evo-token = secret EVO_PAINEL_TOKEN.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { safeEqual } from '../_shared/telegram.ts'

const UNIDADES: Record<string, string> = {
  madalena: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6',
  boa_viagem: 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
  setubal: '00000000-0000-0000-0000-000000000000',
}

const PAGE = 1000
const BUCKET = 'contas-pagar-docs'

const COLS = [
  'id', 'unidade_id', 'descricao', 'fornecedor', 'categoria', 'prioridade', 'centro_custo', 'competencia',
  'observacoes', 'valor', 'data_vencimento', 'forma_pagamento', 'numero_fatura', 'status', 'valor_pago',
  'data_pagamento', 'forma_pagamento_baixa', 'juros', 'multa', 'desconto', 'baixa_observacoes',
  'baixado_por_nome', 'baixado_em', 'cancelado_em', 'created_by_nome', 'created_at', 'updated_at', 'banco',
  'agencia', 'conta_bancaria', 'favorecido', 'link_pagamento',
]
const SELECT = [...COLS, 'documento_url', 'comprovante_url', 'documentos_fiscais'].join(', ')

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const txt = (n: number) => z.string().max(n).nullable()
// Campos editáveis pelo EVO OS. Status/baixa/conferência ficam no CRM.
const Edicao = z.object({
  descricao: z.string().min(1).max(300),
  fornecedor: txt(300),
  categoria: txt(120),
  prioridade: txt(30),
  centro_custo: txt(120),
  competencia: txt(20),
  observacoes: txt(2000),
  valor: z.coerce.number().positive(),
  data_vencimento: data,
  data_pagamento_prevista: data.nullable(),
  forma_pagamento: txt(60),
  numero_fatura: txt(120),
  linha_digitavel: txt(120),
  banco: txt(120),
  agencia: txt(30),
  conta_bancaria: txt(60),
  favorecido: txt(300),
  link_pagamento: txt(1000),
}).partial().strict()

const nomeArq = (p: string) => (p.split('/').pop() || 'documento').replace(/^\d+_/, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('EVO_PAINEL_TOKEN')
  if (!secret || !safeEqual(req.headers.get('x-evo-token'), secret)) return json({ error: 'unauthorized' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const acao: string = body?.acao || 'listar'
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: sc } = await supabase.from('unidades').select('id').eq('slug', 'santa-cruz').maybeSingle()
    const mapa: Record<string, string> = { ...UNIDADES, ...(sc?.id ? { santa_cruz: sc.id } : {}) }
    const todas = Object.values(mapa)

    const carregar = async (id: unknown) => {
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null
      const { data: c } = await supabase.from('contas_pagar').select(SELECT + ', linha_digitavel, data_pagamento_prevista')
        .eq('id', id).is('deleted_at', null).maybeSingle()
      return c && todas.includes((c as any).unidade_id) ? (c as any) : null
    }

    if (acao === 'arquivos') {
      const c = await carregar(body?.conta_id)
      if (!c) return json({ error: 'conta não encontrada' }, 404)
      const docs = [...new Set([...(c.documentos_fiscais ?? []), c.documento_url].filter(Boolean))] as string[]
      const gerar = async (path: string, tipo: string) => {
        const nome = nomeArq(path)
        const [v, d] = await Promise.all([
          supabase.storage.from(BUCKET).createSignedUrl(path, 600),
          supabase.storage.from(BUCKET).createSignedUrl(path, 600, { download: nome }),
        ])
        return { tipo, nome, visualizar_url: v.data?.signedUrl ?? null, baixar_url: d.data?.signedUrl ?? null }
      }
      const arquivos = await Promise.all([
        ...docs.map((p) => gerar(p, 'documento_fiscal')),
        ...(c.comprovante_url ? [gerar(c.comprovante_url, 'comprovante')] : []),
      ])
      return json({ conta_id: c.id, arquivos, expira_em_segundos: 600 })
    }

    if (acao === 'editar') {
      const c = await carregar(body?.conta_id)
      if (!c) return json({ error: 'conta não encontrada' }, 404)
      if (c.status !== 'pendente') return json({ error: 'só contas pendentes podem ser editadas' }, 409)
      const p = Edicao.safeParse(body?.campos ?? {})
      if (!p.success) return json({ error: 'campos inválidos', detalhes: p.error.flatten() }, 400)
      const autor = String(body?.usuario_nome ?? '').trim().slice(0, 120) || 'EVO OS'
      const mudou = Object.entries(p.data).filter(([k, v]) => String(c[k] ?? '') !== String(v ?? ''))
      if (!mudou.length) return json({ ok: true, alterados: 0 })
      const patch = Object.fromEntries(mudou)
      const { error } = await supabase.from('contas_pagar').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', c.id)
      if (error) throw error
      await supabase.from('contas_pagar_historico').insert(mudou.map(([k, v]) => ({
        conta_id: c.id, acao: 'edicao_evo_os', campo: k, user_nome: `${autor} (EVO OS)`,
        valor_anterior: c[k] == null ? null : String(c[k]), valor_novo: v == null ? null : String(v),
      })))
      return json({ ok: true, alterados: mudou.length, campos: Object.keys(patch) })
    }

    if (acao !== 'listar') return json({ error: 'acao inválida (listar, arquivos, editar)' }, 400)

    const unidadeKey: string = body?.unidade || 'consolidado'
    if (unidadeKey !== 'consolidado' && !mapa[unidadeKey]) return json({ error: 'unidade inválida' }, 400)
    const ids = unidadeKey === 'consolidado' ? todas : [mapa[unidadeKey]]

    let desde: string | null = null
    if (body?.atualizadas_desde) {
      const d = new Date(String(body.atualizadas_desde))
      if (Number.isNaN(d.getTime())) return json({ error: 'atualizadas_desde inválido (use ISO 8601)' }, 400)
      desde = d.toISOString()
    }
    const base = (select: string) => {
      let q = supabase.from('contas_pagar').select(select).in('unidade_id', ids)
      if (desde) q = q.gt('updated_at', desde)
      return q
    }
    const rows = await fetchAll<any>(() => base(SELECT).is('deleted_at', null).order('updated_at', { ascending: true }))
    const contas = rows.map((r) => {
      const out: Record<string, unknown> = {}
      for (const c of COLS) out[c] = r[c] ?? null
      const n = new Set([...(r.documentos_fiscais ?? []), r.documento_url].filter(Boolean)).size
      out.documento_presente = n > 0
      out.quantidade_documentos = n
      out.comprovante_presente = Boolean(r.comprovante_url)
      return out
    })
    const removidosRows = await fetchAll<any>(() =>
      base('id, deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: true }))
    const removidos = removidosRows.map((r) => ({ id: r.id, deleted_at: r.deleted_at }))

    return json({
      unidade: unidadeKey, atualizadas_desde: desde, total: contas.length, contas, removidos,
      total_removidos: removidos.length, atualizado_em: new Date().toISOString(),
    })
  } catch (e) {
    const err = e as { message?: string }
    console.error('[painel-contas-pagar]', e)
    return json({ error: err?.message || 'erro interno' }, 500)
  }
})

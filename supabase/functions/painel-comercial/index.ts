import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const UNIDADES: Record<string, string> = {
  madalena: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6',
  boa_viagem: 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
  setubal: '00000000-0000-0000-0000-000000000000',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const nz = (n: number | null | undefined) => (n === null || n === undefined || n === 0 ? null : n)
const pct = (num: number, den: number): number | null => {
  if (!den) return null
  const v = (num / den) * 100
  return Math.round(Math.min(100, Math.max(0, v)) * 100) / 100
}

function normalizePhone(raw: string): string | null {
  let d = (raw || '').replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3) // remove nono dígito
  return d
}

async function hashPhone(digits: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digits))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

const normOrigem = (o: string | null) => {
  const v = (o || 'NÃO INFORMADO').trim()
  if (/^whats\s*app$/i.test(v.replace(/\s+/g, ' '))) return 'WHATSAPP'
  return v.toUpperCase()
}
const isTrafego = (o: string | null) =>
  /tr[aá]fego\s*pago/i.test((o || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('EVO_PAINEL_TOKEN')
  const token = req.headers.get('x-evo-token')
  if (!secret || !token || token !== secret) return json({ error: 'unauthorized' }, 401)

  try {
    const body = await req.json().catch(() => ({}))
    const modo: string = body?.modo || 'resumo'
    const inicio: string = body?.periodo_inicio
    const fim: string = body?.periodo_fim
    const unidadeKey: string = body?.unidade || 'consolidado'

    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fim || '')) {
      return json({ error: 'periodo_inicio e periodo_fim são obrigatórios (YYYY-MM-DD)' }, 400)
    }
    if (unidadeKey !== 'consolidado' && !UNIDADES[unidadeKey]) {
      return json({ error: 'unidade inválida' }, 400)
    }

    const keys = unidadeKey === 'consolidado' ? ['madalena', 'boa_viagem'] : [unidadeKey]
    const ids = keys.map((k) => UNIDADES[k])
    const atualizado_em = new Date().toISOString()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const startTs = `${inicio}T00:00:00.000Z`
    const endTs = `${fim}T23:59:59.999Z`

    if (modo === 'contratos') {
      const telefones: string[] = Array.isArray(body?.telefones) ? body.telefones : []
      if (!telefones.length) return json({ error: 'telefones é obrigatório' }, 400)

      const wanted = new Map<string, string>() // normalizado -> original
      for (const t of telefones) {
        const n = normalizePhone(String(t))
        if (n) wanted.set(n, String(t))
      }

      const { data: leads, error: leadsErr } = await supabase
        .from('leads')
        .select('id, telefone_normalizado, unidade_id')
        .in('unidade_id', ids)
      if (leadsErr) throw leadsErr

      const byNorm = new Map<string, string[]>()
      for (const l of leads || []) {
        const n = normalizePhone(l.telefone_normalizado || '')
        if (!n || !wanted.has(n)) continue
        byNorm.set(n, [...(byNorm.get(n) || []), l.id])
      }

      const leadIds = [...byNorm.values()].flat()
      let matriculas: any[] = []
      if (leadIds.length) {
        const { data, error } = await supabase
          .from('interacoes')
          .select('lead_id, valor_plano, data_fechamento')
          .in('lead_id', leadIds)
          .eq('fechou_matricula', true)
          .order('data_fechamento', { ascending: false })
        if (error) throw error
        matriculas = data || []
      }

      const contratos: any[] = []
      let casaram = 0
      for (const [norm, lids] of byNorm.entries()) {
        const m = matriculas.find((x) => lids.includes(x.lead_id))
        casaram++
        contratos.push({
          telefone_hash: await hashPhone(norm),
          valor_plano: m?.valor_plano ?? null,
          data_fechamento: m?.data_fechamento ?? null,
        })
      }

      return json({
        modo: 'contratos',
        unidade: unidadeKey,
        casaram: nz(casaram),
        nao_casaram: nz(wanted.size - casaram),
        contratos,
        atualizado_em,
      })
    }

    // ---------- modo resumo ----------
    const [leadsRes, intRes, npsRes, metasRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id, unidade_id, origem, status_funil, created_at')
        .eq('ativo', true)
        .in('unidade_id', ids)
        .gte('created_at', startTs)
        .lte('created_at', endTs),
      supabase
        .from('interacoes')
        .select(
          'id, lead_id, unidade_id, agendou_experimental, compareceu, fechou_matricula, data_experimental, data_fechamento, valor_plano',
        )
        .in('unidade_id', ids),
      supabase
        .from('nps_respostas')
        .select('unidade_id, nota_nps, categoria, created_at')
        .in('unidade_id', ids)
        .gte('created_at', startTs)
        .lte('created_at', endTs),
      supabase
        .from('gestao_metas')
        .select('unidade_id, alunos_ativos_manual, evasao_pct_manual, ticket_medio_real, updated_at, created_at')
        .in('unidade_id', ids)
        .order('updated_at', { ascending: false }),
    ])
    for (const r of [leadsRes, intRes, npsRes, metasRes]) if (r.error) throw r.error

    const leads = leadsRes.data || []
    const interacoes = intRes.data || []
    const nps = npsRes.data || []
    const metas = metasRes.data || []

    // coorte precisa de todas interações dos leads da coorte (já buscamos todas da unidade)
    const inPeriodExp = (d: string | null) => !!d && d >= inicio && d <= fim
    const inPeriodFech = (d: string | null) => !!d && d >= inicio && d <= fim

    const now = Date.now()
    const CUT = 14 * 24 * 60 * 60 * 1000

    const buildUnidade = (unitIds: string[]) => {
      const L = leads.filter((l) => unitIds.includes(l.unidade_id))
      const I = interacoes.filter((i) => unitIds.includes(i.unidade_id))
      const N = nps.filter((n) => unitIds.includes(n.unidade_id))

      const agendadas = I.filter((i) => i.agendou_experimental === true && inPeriodExp(i.data_experimental))
      const compareceram = I.filter((i) => i.compareceu === true && inPeriodExp(i.data_experimental))
      const matriculas = I.filter((i) => i.fechou_matricula === true && inPeriodFech(i.data_fechamento))

      const funil_absoluto = {
        leads: nz(L.length),
        experimentais_agendadas: nz(agendadas.length),
        comparecimentos: nz(compareceram.length),
        matriculas: nz(matriculas.length),
      }

      // coorte
      const coorte = L.filter((l) => now - new Date(l.created_at).getTime() >= CUT)
      const fora_da_coorte = L.length - coorte.length
      const intByLead = new Map<string, any[]>()
      for (const i of I) {
        if (!i.lead_id) continue
        intByLead.set(i.lead_id, [...(intByLead.get(i.lead_id) || []), i])
      }
      let ag = 0
      let cp = 0
      let mt = 0
      for (const l of coorte) {
        const start = new Date(l.created_at).getTime()
        const end = start + CUT
        const its = (intByLead.get(l.id) || []).filter((i) => {
          const ref = i.data_experimental || i.data_fechamento
          if (!ref) return false
          const t = new Date(`${ref}T12:00:00Z`).getTime()
          return t >= start - 24 * 60 * 60 * 1000 && t <= end
        })
        if (its.some((i) => i.agendou_experimental === true)) ag++
        if (its.some((i) => i.compareceu === true)) cp++
        if (its.some((i) => i.fechou_matricula === true)) mt++
      }

      const funil_coorte = {
        total_coorte: nz(coorte.length),
        agendaram: nz(ag),
        compareceram: nz(cp),
        matricularam: nz(mt),
        pct_agendaram: pct(ag, coorte.length),
        pct_compareceram: pct(cp, ag),
        pct_matricularam: pct(mt, cp),
        fora_da_coorte: nz(fora_da_coorte),
      }

      const origens: Record<string, number> = {}
      for (const l of L) {
        const k = normOrigem(l.origem)
        origens[k] = (origens[k] || 0) + 1
      }

      const status_funil: Record<string, number> = {}
      for (const l of L) {
        const k = l.status_funil || 'sem_status'
        status_funil[k] = (status_funil[k] || 0) + 1
      }

      const leadsTP = L.filter((l) => isTrafego(l.origem))
      const tpLeadIds = new Set(leadsTP.map((l) => l.id))
      const trafego_pago = {
        leads: nz(leadsTP.length),
        experimentais_agendadas: nz(agendadas.filter((i) => tpLeadIds.has(i.lead_id)).length),
        comparecimentos: nz(compareceram.filter((i) => tpLeadIds.has(i.lead_id)).length),
        matriculas: nz(matriculas.filter((i) => tpLeadIds.has(i.lead_id)).length),
      }

      let npsBlock: any = null
      if (N.length) {
        const prom = N.filter((n) => (n.nota_nps ?? -1) >= 9).length
        const det = N.filter((n) => (n.nota_nps ?? 99) <= 6).length
        const pas = N.length - prom - det
        npsBlock = {
          respostas: N.length,
          promotores: prom,
          passivos: pas,
          detratores: det,
          nota_nps: Math.round(((prom / N.length) * 100 - (det / N.length) * 100) * 100) / 100,
        }
      }

      const valores = matriculas
        .map((m) => Number(m.valor_plano))
        .filter((v) => Number.isFinite(v) && v > 0)
      const soma = valores.reduce((a, b) => a + b, 0)
      const ticket = {
        soma_valor_plano: nz(Math.round(soma * 100) / 100),
        ticket_medio: valores.length ? Math.round((soma / valores.length) * 100) / 100 : null,
        matriculas_com_valor: nz(valores.length),
      }

      const meta = metas.find((m) => unitIds.includes(m.unidade_id)) || null
      const metasBlock = meta
        ? {
            alunos_ativos_manual: meta.alunos_ativos_manual ?? null,
            evasao_pct_manual: meta.evasao_pct_manual ?? null,
            ticket_medio_real: meta.ticket_medio_real ?? null,
          }
        : null

      return {
        funil_absoluto,
        funil_coorte,
        origens: Object.keys(origens).length ? origens : null,
        status_funil: Object.keys(status_funil).length ? status_funil : null,
        trafego_pago,
        nps: npsBlock,
        metas: metasBlock,
        ticket,
      }
    }

    const porUnidade: Record<string, unknown> = {}
    for (const k of keys) porUnidade[k] = buildUnidade([UNIDADES[k]])

    return json({
      modo: 'resumo',
      unidade: unidadeKey,
      periodo: { inicio, fim },
      unidades: porUnidade,
      consolidado: buildUnidade(ids),
      atualizado_em,
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

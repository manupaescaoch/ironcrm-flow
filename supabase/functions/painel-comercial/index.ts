import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const UNIDADES: Record<string, string> = {
  madalena: 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6',
  boa_viagem: 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a',
  setubal: '00000000-0000-0000-0000-000000000000',
}

const PAGE = 1000

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// pct devolve null apenas quando não há denominador (não dá para calcular)
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

// Busca TODAS as linhas paginando; nunca confia no limite padrão do PostgREST.
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

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
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
    const modo: string = body?.modo || 'resumo'
    // aceita YYYY-MM-DD ou ISO completo (usa só a parte da data)
    const toDay = (v: unknown) => {
      const s = String(v ?? '')
      return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''
    }
    const inicio: string = toDay(body?.periodo_inicio)
    const fim: string = toDay(body?.periodo_fim)
    const unidadeKey: string = body?.unidade || 'consolidado'

    if (!inicio || !fim) {
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

    // contagem exata no servidor (head:true, sem trazer linhas)
    const countExact = async (apply: (q: any) => any): Promise<number> => {
      const { count, error } = await apply(
        supabase.from('interacoes').select('id', { count: 'exact', head: true }),
      )
      if (error) throw error
      return count ?? 0
    }

    if (modo === 'contratos') {
      const telefones: string[] = Array.isArray(body?.telefones) ? body.telefones : []
      if (!telefones.length) return json({ error: 'telefones é obrigatório' }, 400)

      const wanted = new Map<string, string>() // normalizado -> original
      for (const t of telefones) {
        const n = normalizePhone(String(t))
        if (n) wanted.set(n, String(t))
      }

      // paginado: a base de leads da unidade passa de 1.000 linhas
      const leads = await fetchAll<{ id: string; telefone_normalizado: string | null }>(() =>
        supabase.from('leads').select('id, telefone_normalizado').in('unidade_id', ids),
      )

      const byNorm = new Map<string, string[]>()
      for (const l of leads) {
        const n = normalizePhone(l.telefone_normalizado || '')
        if (!n || !wanted.has(n)) continue
        byNorm.set(n, [...(byNorm.get(n) || []), l.id])
      }

      const leadIds = [...byNorm.values()].flat()
      const matriculas: any[] = []
      for (const part of chunk(leadIds, 200)) {
        const rows = await fetchAll(() =>
          supabase
            .from('interacoes')
            .select('lead_id, valor_plano, data_fechamento')
            .in('lead_id', part)
            .eq('fechou_matricula', true)
            .order('data_fechamento', { ascending: false }),
        )
        matriculas.push(...rows)
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
        casaram,
        nao_casaram: wanted.size - casaram,
        contratos,
        atualizado_em,
      })
    }

    // ---------- modo resumo ----------
    // Leads do período (paginado)
    const leads = await fetchAll<any>(() =>
      supabase
        .from('leads')
        .select('id, unidade_id, origem, status_funil, created_at')
        .eq('ativo', true)
        .in('unidade_id', ids)
        .gte('created_at', startTs)
        .lte('created_at', endTs),
    )

    // Interações do período, já filtradas no servidor por data + flag (paginado)
    const [rowsAgendadas, rowsCompareceram, rowsMatriculas] = await Promise.all([
      fetchAll<any>(() =>
        supabase
          .from('interacoes')
          .select('id, lead_id, unidade_id, data_experimental')
          .in('unidade_id', ids)
          .eq('agendou_experimental', true)
          .gte('data_experimental', inicio)
          .lte('data_experimental', fim),
      ),
      fetchAll<any>(() =>
        supabase
          .from('interacoes')
          .select('id, lead_id, unidade_id, data_experimental')
          .in('unidade_id', ids)
          .eq('compareceu', true)
          .gte('data_experimental', inicio)
          .lte('data_experimental', fim),
      ),
      fetchAll<any>(() =>
        supabase
          .from('interacoes')
          .select('id, lead_id, unidade_id, data_fechamento, valor_plano')
          .in('unidade_id', ids)
          .eq('fechou_matricula', true)
          .gte('data_fechamento', inicio)
          .lte('data_fechamento', fim),
      ),
    ])

    // Contagens exatas por unidade (validação server-side, count sem linhas)
    const countsByUnit = new Map<
      string,
      { agendadas: number; comparecimentos: number; matriculas: number }
    >()
    for (const id of ids) {
      const [agendadas, comparecimentos, matriculas] = await Promise.all([
        countExact((q) =>
          q
            .eq('unidade_id', id)
            .eq('agendou_experimental', true)
            .gte('data_experimental', inicio)
            .lte('data_experimental', fim),
        ),
        countExact((q) =>
          q
            .eq('unidade_id', id)
            .eq('compareceu', true)
            .gte('data_experimental', inicio)
            .lte('data_experimental', fim),
        ),
        countExact((q) =>
          q
            .eq('unidade_id', id)
            .eq('fechou_matricula', true)
            .gte('data_fechamento', inicio)
            .lte('data_fechamento', fim),
        ),
      ])
      countsByUnit.set(id, { agendadas, comparecimentos, matriculas })
    }

    // Fechamentos no MESMO DIA da experimental (compareceu + fechou_matricula), paginado
    const rowsMesmoDia = await fetchAll<any>(() =>
      supabase
        .from('interacoes')
        .select('id, lead_id, unidade_id, data_experimental, data_fechamento')
        .in('unidade_id', ids)
        .eq('compareceu', true)
        .eq('fechou_matricula', true)
        .not('data_fechamento', 'is', null)
        .gte('data_experimental', inicio)
        .lte('data_experimental', fim),
    )
    const dayKey = (v: string | null) => (v ? String(v).slice(0, 10) : null)
    const mesmoDiaRows = rowsMesmoDia.filter(
      (r) => dayKey(r.data_experimental) && dayKey(r.data_experimental) === dayKey(r.data_fechamento),
    )

    // Follow-ups atrasados: ESTADO ATUAL (ignora o filtro de período)
    // Três filas:
    //  - pendentes    → linhas reais em follow_ups (fila comercial), status pendente/enviando e data_prevista < agora
    //  - matriculados → fila derivada da data da matrícula (D+1 / D+7 / D+30), vencida
    //  - gerente      → fila derivada da data da matrícula (G+7 / G+30), vencida
    const nowIso = new Date().toISOString()
    type AtrasoBreak = { pendentes: number; matriculados: number; gerente: number }
    const atrasadosByUnit = new Map<string, AtrasoBreak>()

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = (from: Date, to: Date) =>
      Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000)

    // etapa das filas derivadas: retorna [tipo, alvoEmDias] ou null
    const etapaMatriculado = (dias: number): [string, number] | null => {
      if (dias < 0) return null
      if (dias <= 1) return ['D+1', 1]
      if (dias <= 15) return ['D+7', 7]
      if (dias <= 45) return ['D+30', 30]
      return null
    }
    const etapaGerente = (dias: number): [string, number] | null => {
      if (dias < 7) return null
      if (dias <= 29) return ['G+7', 7]
      if (dias <= 45) return ['G+30', 30]
      return null
    }

    for (const id of ids) {
      const { count, error } = await supabase
        .from('follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('unidade_id', id)
        .in('status', ['pendente', 'enviando'])
        .lt('data_prevista', nowIso)
      if (error) throw error
      const pendentes = count ?? 0

      // matrículas ativas da unidade (paginado)
      const matriculasUnidade = await fetchAll<any>(() =>
        supabase
          .from('interacoes')
          .select('lead_id, data_fechamento, leads!inner (id, is_matriculado, ativo)')
          .eq('unidade_id', id)
          .eq('fechou_matricula', true)
          .not('data_fechamento', 'is', null)
          .order('data_fechamento', { ascending: false }),
      )

      const maisRecentePorLead = new Map<string, string>()
      for (const row of matriculasUnidade) {
        const lead = row.leads
        if (!lead || lead.is_matriculado !== true || lead.ativo === false) continue
        if (!maisRecentePorLead.has(row.lead_id)) {
          maisRecentePorLead.set(row.lead_id, row.data_fechamento)
        }
      }

      const leadIdsMat = [...maisRecentePorLead.keys()]
      const fusLeads: any[] = []
      for (const part of chunk(leadIdsMat, 200)) {
        const rows = await fetchAll<any>(() =>
          supabase
            .from('follow_ups')
            .select('lead_id, tipo, status, data_prevista')
            .in('lead_id', part)
            .in('tipo', ['D+1', 'D+7', 'D+30', 'G+7', 'G+30']),
        )
        fusLeads.push(...rows)
      }

      const hoje0 = startOfDay(new Date())
      const concluidos = new Set<string>()
      const reagendadoFuturo = new Set<string>()
      for (const f of fusLeads) {
        const key = `${f.lead_id}|${f.tipo}`
        if (f.status === 'concluido') concluidos.add(key)
        else if (f.status === 'pendente' && f.data_prevista) {
          if (new Date(f.data_prevista) > hoje0) reagendadoFuturo.add(key)
        }
      }

      let matriculados = 0
      let gerente = 0
      for (const [leadId, dataFechamento] of maisRecentePorLead) {
        const dias = diffDays(new Date(dataFechamento), new Date())

        const em = etapaMatriculado(dias)
        if (em && dias > em[1]) {
          const key = `${leadId}|${em[0]}`
          if (!concluidos.has(key) && !reagendadoFuturo.has(key)) matriculados++
        }

        const eg = etapaGerente(dias)
        if (eg && dias > eg[1]) {
          const key = `${leadId}|${eg[0]}`
          if (!concluidos.has(key) && !reagendadoFuturo.has(key)) gerente++
        }
      }

      atrasadosByUnit.set(id, { pendentes, matriculados, gerente })
    }


    const nps = await fetchAll<any>(() =>
      supabase
        .from('nps_respostas')
        .select('unidade_id, nota_nps, categoria, created_at')
        .in('unidade_id', ids)
        .gte('created_at', startTs)
        .lte('created_at', endTs),
    )

    const metas = await fetchAll<any>(() =>
      supabase
        .from('gestao_metas')
        .select('unidade_id, alunos_ativos_manual, evasao_pct_manual, ticket_medio_real, updated_at, created_at')
        .in('unidade_id', ids)
        .order('updated_at', { ascending: false }),
    )

    // ---- coorte: interações apenas dos leads da coorte, em lotes e paginado ----
    const now = Date.now()
    const CUT = 14 * 24 * 60 * 60 * 1000
    const coorteLeads = leads.filter((l) => now - new Date(l.created_at).getTime() >= CUT)
    const coorteInteracoes: any[] = []
    for (const part of chunk(coorteLeads.map((l) => l.id), 200)) {
      const rows = await fetchAll<any>(() =>
        supabase
          .from('interacoes')
          .select(
            'lead_id, unidade_id, agendou_experimental, compareceu, fechou_matricula, data_experimental, data_fechamento',
          )
          .in('lead_id', part),
      )
      coorteInteracoes.push(...rows)
    }
    const intByLead = new Map<string, any[]>()
    for (const i of coorteInteracoes) {
      if (!i.lead_id) continue
      intByLead.set(i.lead_id, [...(intByLead.get(i.lead_id) || []), i])
    }

    const buildUnidade = (unitIds: string[]) => {
      const L = leads.filter((l) => unitIds.includes(l.unidade_id))
      const N = nps.filter((n) => unitIds.includes(n.unidade_id))
      const agendadasRows = rowsAgendadas.filter((i) => unitIds.includes(i.unidade_id))
      const compareceramRows = rowsCompareceram.filter((i) => unitIds.includes(i.unidade_id))
      const matriculasRows = rowsMatriculas.filter((i) => unitIds.includes(i.unidade_id))

      const sum = (pick: (c: { agendadas: number; comparecimentos: number; matriculas: number }) => number) =>
        unitIds.reduce((acc, id) => acc + pick(countsByUnit.get(id) || { agendadas: 0, comparecimentos: 0, matriculas: 0 }), 0)

      const funil_absoluto = {
        leads: L.length,
        experimentais_agendadas: sum((c) => c.agendadas),
        comparecimentos: sum((c) => c.comparecimentos),
        matriculas: sum((c) => c.matriculas),
      }

      // coorte (leads com pelo menos 14 dias de maturação)
      const coorte = L.filter((l) => now - new Date(l.created_at).getTime() >= CUT)
      const fora_da_coorte = L.length - coorte.length
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
        total_coorte: coorte.length,
        agendaram: ag,
        compareceram: cp,
        matricularam: mt,
        pct_agendaram: pct(ag, coorte.length),
        pct_compareceram: pct(cp, ag),
        pct_matricularam: pct(mt, cp),
        fora_da_coorte,
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
        leads: leadsTP.length,
        experimentais_agendadas: agendadasRows.filter((i) => tpLeadIds.has(i.lead_id)).length,
        comparecimentos: compareceramRows.filter((i) => tpLeadIds.has(i.lead_id)).length,
        matriculas: matriculasRows.filter((i) => tpLeadIds.has(i.lead_id)).length,
      }

      // null só quando não há nenhuma resposta (não dá para calcular nota)
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

      const valores = matriculasRows
        .map((m) => Number(m.valor_plano))
        .filter((v) => Number.isFinite(v) && v > 0)
      const soma = valores.reduce((a, b) => a + b, 0)
      const ticket = {
        soma_valor_plano: Math.round(soma * 100) / 100,
        // null só quando não há denominador
        ticket_medio: valores.length ? Math.round((soma / valores.length) * 100) / 100 : null,
        matriculas_com_valor: valores.length,
      }

      const meta = metas.find((m) => unitIds.includes(m.unidade_id)) || null
      const metasBlock = meta
        ? {
            alunos_ativos_manual: meta.alunos_ativos_manual ?? null,
            evasao_pct_manual: meta.evasao_pct_manual ?? null,
            ticket_medio_real: meta.ticket_medio_real ?? null,
          }
        : null

      const comparecimentosPeriodo = sum((c) => c.comparecimentos)
      const fechamentosMesmoDia = mesmoDiaRows.filter((r) => unitIds.includes(r.unidade_id)).length
      const conversao_imediata = {
        fechamentos_mesmo_dia: fechamentosMesmoDia,
        comparecimentos: comparecimentosPeriodo,
        // null quando não há comparecimento no período (sem denominador)
        pct: pct(fechamentosMesmoDia, comparecimentosPeriodo),
      }

      const followups_atrasados = {
        total: unitIds.reduce((acc, id) => acc + (atrasadosByUnit.get(id) ?? 0), 0),
        ignora_periodo: true,
        referencia: 'estado_atual',
        medido_em: nowIso,
      }

      return {
        funil_absoluto,
        funil_coorte,
        origens,
        status_funil,
        trafego_pago,
        nps: npsBlock,
        metas: metasBlock,
        ticket,
        conversao_imediata,
        followups_atrasados,
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

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TARGET_PHONE = '5581996392285' // de quem recebemos a resposta
const RESUMO_PHONE = '5581999095748' // para quem enviamos o resumo
const ZN_ID = 'b4df0ba8-7fa8-4f28-8924-d5ce6a9b50c6'
const ZS_ID = 'f3d048da-31d7-48df-b1f1-7e2a809c9a9a'

interface ZapiWebhook {
  phone?: string
  fromMe?: boolean
  isStatusReply?: boolean
  text?: { message?: string }
  type?: string
}

function parseInvestimento(text: string, leadsZn: number, leadsZs: number): { zn: number; zs: number } {
  const t = text.toLowerCase().replace(/\./g, '').replace(/,/g, '.')
  // Buscar ZN/ZS explicitamente
  const znMatch = t.match(/zn[^\d]*(\d+(?:\.\d+)?)/)
  const zsMatch = t.match(/zs[^\d]*(\d+(?:\.\d+)?)/)
  if (znMatch && zsMatch) {
    return { zn: parseFloat(znMatch[1]), zs: parseFloat(zsMatch[1]) }
  }
  // Caso contrário, primeiro número = total
  const numMatch = t.match(/(\d+(?:\.\d+)?)/)
  const total = numMatch ? parseFloat(numMatch[1]) : 0
  const totalLeads = leadsZn + leadsZs
  if (totalLeads === 0) return { zn: total / 2, zs: total / 2 }
  return {
    zn: (total * leadsZn) / totalLeads,
    zs: (total * leadsZs) / totalLeads,
  }
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtLTV(v: number) {
  if (v >= 1000) {
    const k = v / 1000
    return `R$ ${k.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('.', ',')}k`
  }
  return `R$ ${fmtBRL(v)}`
}

function fmtPct(v: number) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

async function calcularUnidade(
  supabase: any,
  unidadeId: string,
  inicio: string,
  fim: string,
  investimento: number
) {
  // Leads criados na semana
  const { data: leads } = await supabase
    .from('leads')
    .select('id, created_at')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .gte('created_at', `${inicio}T00:00:00`)
    .lte('created_at', `${fim}T23:59:59`)

  const totalLeads = leads?.length ?? 0

  // Interações da semana (agendamentos, comparecimentos, matrículas)
  const { data: inters } = await supabase
    .from('interacoes')
    .select('id, lead_id, agendou_experimental, compareceu, fechou_matricula, valor_plano, data_experimental, data_fechamento, data_interacao')
    .eq('unidade_id', unidadeId)

  const inInterval = (dStr: string | null) => {
    if (!dStr) return false
    const d = dStr.slice(0, 10)
    return d >= inicio && d <= fim
  }

  let agendamentos = 0
  let comparecimentos = 0
  let matriculas = 0
  let faturamento = 0

  for (const i of inters ?? []) {
    if (i.agendou_experimental && inInterval(i.data_experimental ?? i.data_interacao)) agendamentos++
    if (i.compareceu && inInterval(i.data_experimental ?? i.data_interacao)) comparecimentos++
    if (i.fechou_matricula && inInterval(i.data_fechamento ?? i.data_interacao)) {
      matriculas++
      faturamento += Number(i.valor_plano ?? 0)
    }
  }

  const cpl = totalLeads > 0 ? investimento / totalLeads : 0
  const cpa = matriculas > 0 ? investimento / matriculas : 0
  const leadAtend = totalLeads > 0 ? (comparecimentos / totalLeads) * 100 : 0
  const atendAluno = comparecimentos > 0 ? (matriculas / comparecimentos) * 100 : 0
  const ticket = matriculas > 0 ? faturamento / matriculas : 0

  return { totalLeads, agendamentos, comparecimentos, matriculas, faturamento, cpl, cpa, leadAtend, atendAluno, ticket }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = (await req.json()) as ZapiWebhook
    console.log('Webhook recebido', JSON.stringify(body))

    if (body.fromMe || body.isStatusReply) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const phone = body.phone
    const text = body.text?.message?.trim()
    if (!phone || !text || phone !== TARGET_PHONE) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: pendente } = await supabase
      .from('resumo_semanal_pendentes')
      .select('*')
      .eq('telefone', TARGET_PHONE)
      .eq('status', 'pendente')
      .order('enviado_em', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!pendente) {
      return new Response(JSON.stringify({ ok: true, no_pending: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { semana_inicio: inicio, semana_fim: fim } = pendente

    const { count: leadsZnCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', ZN_ID)
      .eq('ativo', true)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fim}T23:59:59`)

    const { count: leadsZsCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('unidade_id', ZS_ID)
      .eq('ativo', true)
      .gte('created_at', `${inicio}T00:00:00`)
      .lte('created_at', `${fim}T23:59:59`)

    const inv = parseInvestimento(text, leadsZnCount ?? 0, leadsZsCount ?? 0)

    const zn = await calcularUnidade(supabase, ZN_ID, inicio, fim, inv.zn)
    const zs = await calcularUnidade(supabase, ZS_ID, inicio, fim, inv.zs)

    const totalInvestido = inv.zn + inv.zs
    const totalLeads = zn.totalLeads + zs.totalLeads
    const totalMatriculas = zn.matriculas + zs.matriculas
    const cplGeral = totalLeads > 0 ? totalInvestido / totalLeads : 0
    const cpaGeral = totalMatriculas > 0 ? totalInvestido / totalMatriculas : 0
    const conversaoGeral = totalLeads > 0 ? (totalMatriculas / totalLeads) * 100 : 0

    const fmtDate = (s: string) => {
      const [y, m, d] = s.split('-')
      return `${d}/${m}`
    }

    const msg =
`📊 *RESUMO SEMANAL CRM*
*Período: ${fmtDate(inicio)} a ${fmtDate(fim)}*

*ZN — Zona Norte*
Leads: ${zn.totalLeads}
Comparecimentos: ${zn.comparecimentos}
Matrículas: ${zn.matriculas}
Faturamento: R$ ${fmtBRL(zn.faturamento)}
Lead → Atend.: ${fmtPct(zn.leadAtend)}
Atend. → Aluno: ${fmtPct(zn.atendAluno)}
CPL: R$ ${fmtBRL(zn.cpl)}
CPA: R$ ${fmtBRL(zn.cpa)}
Ticket Médio: R$ ${fmtBRL(zn.ticket)}

*ZS — Zona Sul*
Leads: ${zs.totalLeads}
Comparecimentos: ${zs.comparecimentos}
Matrículas: ${zs.matriculas}
Faturamento: R$ ${fmtBRL(zs.faturamento)}
Lead → Atend.: ${fmtPct(zs.leadAtend)}
Atend. → Aluno: ${fmtPct(zs.atendAluno)}
CPL: R$ ${fmtBRL(zs.cpl)}
CPA: R$ ${fmtBRL(zs.cpa)}
Ticket Médio: R$ ${fmtBRL(zs.ticket)}

*CONSOLIDADO*
Total Investido: R$ ${fmtBRL(totalInvestido)}
Total Leads: ${totalLeads}
Total Matrículas: ${totalMatriculas}
CPL Geral: R$ ${fmtBRL(cplGeral)}
CPA Geral: R$ ${fmtBRL(cpaGeral)}
Conversão Geral: ${fmtPct(conversaoGeral)}`

    // Enviar resposta
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID')!
    const tokenZ = Deno.env.get('ZAPI_TOKEN')!
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')!

    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${tokenZ}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
        body: JSON.stringify({ phone: RESUMO_PHONE, message: msg }),
      }
    )
    const zapiBody = await zapiRes.text()
    console.log('Z-API resumo enviado', zapiRes.status, zapiBody)

    // Atualizar pendência
    await supabase
      .from('resumo_semanal_pendentes')
      .update({
        status: 'respondido',
        valor_zn: inv.zn,
        valor_zs: inv.zs,
        resposta_raw: text,
        respondido_em: new Date().toISOString(),
      })
      .eq('id', pendente.id)

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('Erro webhook resposta', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

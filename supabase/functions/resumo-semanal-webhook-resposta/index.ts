import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
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

function fmtPct(v: number) {
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function normalizeOrigem(o: string | null | undefined): string {
  if (!o) return 'OUTROS'
  const s = o.toString().toUpperCase().trim()
  if (s.includes('INSTAGRAM')) return 'INSTAGRAM'
  if (s.includes('INDICA')) return 'INDICAÇÃO'
  if (s.includes('PRESENC') || s.includes('VISITA')) return 'VISITA PRESENCIAL'
  if (s.includes('TRÁFEGO') || s.includes('TRAFEGO') || s.includes('PAGO')) return 'TRÁFEGO PAGO'
  return 'OUTROS'
}

async function calcularUnidade(
  supabase: any,
  unidadeId: string,
  inicio: string,
  fim: string,
) {
  // Leads criados na semana
  const { data: leads } = await supabase
    .from('leads')
    .select('id, created_at, origem')
    .eq('unidade_id', unidadeId)
    .eq('ativo', true)
    .gte('created_at', `${inicio}T00:00:00`)
    .lte('created_at', `${fim}T23:59:59`)

  const totalLeads = leads?.length ?? 0

  // Origem dos leads
  const origens: Record<string, number> = {
    'INSTAGRAM': 0,
    'INDICAÇÃO': 0,
    'VISITA PRESENCIAL': 0,
    'TRÁFEGO PAGO': 0,
    'OUTROS': 0,
  }
  for (const l of leads ?? []) {
    const o = normalizeOrigem(l.origem)
    origens[o] = (origens[o] ?? 0) + 1
  }

  // Interações da semana
  const { data: inters } = await supabase
    .from('interacoes')
    .select('id, lead_id, agendou_experimental, compareceu, fechou_matricula, data_experimental, data_fechamento, data_interacao, created_at')
    .eq('unidade_id', unidadeId)

  const inInterval = (dStr: string | null) => {
    if (!dStr) return false
    const d = dStr.slice(0, 10)
    return d >= inicio && d <= fim
  }

  let agendamentos = 0
  let comparecimentos = 0
  let matriculas = 0
  let fechamentoNoDia = 0 // matrículas onde data_fechamento == data_experimental (mesmo dia da experimental)

  for (const i of inters ?? []) {
    if (i.agendou_experimental && inInterval(i.data_experimental ?? i.data_interacao)) agendamentos++
    if (i.compareceu && inInterval(i.data_experimental ?? i.data_interacao)) comparecimentos++
    if (i.fechou_matricula && inInterval(i.data_fechamento ?? i.data_interacao)) {
      matriculas++
      // Fechamento no dia: data_fechamento igual à data_experimental
      if (i.data_fechamento && i.data_experimental && i.data_fechamento.slice(0, 10) === i.data_experimental.slice(0, 10)) {
        fechamentoNoDia++
      }
    }
  }

  const conversao = totalLeads > 0 ? (matriculas / totalLeads) * 100 : 0
  const taxaComparecimento = agendamentos > 0 ? (comparecimentos / agendamentos) * 100 : 0
  const pctFechamentoDia = comparecimentos > 0 ? (fechamentoNoDia / comparecimentos) * 100 : 0

  return {
    totalLeads,
    agendamentos,
    comparecimentos,
    matriculas,
    fechamentoNoDia,
    pctFechamentoDia,
    conversao,
    taxaComparecimento,
    origens,
  }
}

function blocoUnidade(nome: string, sigla: string, u: any) {
  return `🏢 *${sigla} — ${nome}*

• 📈 *Leads qualificados:* ${u.totalLeads}
• 📅 *Aulas agendadas:* ${u.agendamentos}
• ✅ *Comparecimentos:* ${u.comparecimentos}
• 💳 *Matrículas:* ${u.matriculas}
• ⚡ *Fechamento no dia:* ${u.fechamentoNoDia} (${fmtPct(u.pctFechamentoDia)})
• ⭐ *Conversão:* ${fmtPct(u.conversao)}
• 🌟 *Taxa de comparecimento:* ${fmtPct(u.taxaComparecimento)}

📌 *Origem dos leads*
• Instagram: ${u.origens['INSTAGRAM']}
• Indicação: ${u.origens['INDICAÇÃO']}
• Visita Presencial: ${u.origens['VISITA PRESENCIAL']}
• Tráfego Pago: ${u.origens['TRÁFEGO PAGO']}
• Outros: ${u.origens['OUTROS']}`
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

    const zn = await calcularUnidade(supabase, ZN_ID, inicio, fim)
    const zs = await calcularUnidade(supabase, ZS_ID, inicio, fim)

    const totalLeads = zn.totalLeads + zs.totalLeads
    const totalAgend = zn.agendamentos + zs.agendamentos
    const totalComp = zn.comparecimentos + zs.comparecimentos
    const totalMatr = zn.matriculas + zs.matriculas
    const totalFechDia = zn.fechamentoNoDia + zs.fechamentoNoDia
    const conversaoGeral = totalLeads > 0 ? (totalMatr / totalLeads) * 100 : 0
    const taxaCompGeral = totalAgend > 0 ? (totalComp / totalAgend) * 100 : 0
    const pctFechDiaGeral = totalComp > 0 ? (totalFechDia / totalComp) * 100 : 0

    const fmtDate = (s: string) => {
      const [y, m, d] = s.split('-')
      return `${d}/${m}`
    }

    const msg = `📈 *RESUMO SEMANAL CRM*
📅 *Período:* ${fmtDate(inicio)} a ${fmtDate(fim)}

———

${blocoUnidade('Zona Norte', 'ZN', zn)}

———

${blocoUnidade('Zona Sul', 'ZS', zs)}

———

🌟 *CONSOLIDADO*

• 📈 *Total de leads qualificados:* ${totalLeads}
• 📅 *Total de aulas agendadas:* ${totalAgend}
• ✅ *Total de comparecimentos:* ${totalComp}
• 💳 *Total de matrículas:* ${totalMatr}
• ⚡ *Fechamento no dia:* ${totalFechDia} (${fmtPct(pctFechDiaGeral)})
• ⭐ *Conversão geral:* ${fmtPct(conversaoGeral)}
• 🌟 *Taxa geral de comparecimento:* ${fmtPct(taxaCompGeral)}`

    // Enviar resposta
    const instanceId = (Deno.env.get('ZAPI_OPERACIONAL_INSTANCE_ID') ?? Deno.env.get('ZAPI_INSTANCE_ID'))!
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

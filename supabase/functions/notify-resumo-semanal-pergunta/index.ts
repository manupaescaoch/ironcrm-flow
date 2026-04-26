import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TARGET_PHONE = '5581996392285'

function getPreviousWeekRange(now: Date) {
  // Semana ANTERIOR completa: domingo a sábado, terminando no último sábado.
  // Se rodar no sábado, considera o sábado anterior como fim do período.
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const dow = brt.getUTCDay() // 0 = dom, 6 = sab
  const daysBackToSaturday = dow === 6 ? 7 : dow + 1
  const end = new Date(brt)
  end.setUTCDate(brt.getUTCDate() - daysBackToSaturday)
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - 6)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { inicio: fmt(start), fim: fmt(end) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { inicio, fim } = getPreviousWeekRange(new Date())

    // Marcar pendências antigas como expiradas
    await supabase
      .from('resumo_semanal_pendentes')
      .update({ status: 'expirado' })
      .eq('telefone', TARGET_PHONE)
      .eq('status', 'pendente')

    // Inserir nova pendência
    const { data: pendente, error: insErr } = await supabase
      .from('resumo_semanal_pendentes')
      .insert({
        telefone: TARGET_PHONE,
        semana_inicio: inicio,
        semana_fim: fim,
        status: 'pendente',
      })
      .select()
      .single()

    if (insErr) throw insErr

    // Enviar pergunta via Z-API
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID')!
    const token = Deno.env.get('ZAPI_TOKEN')!
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')!

    const message = 'Qual foi o valor investido em tráfego pago essa semana? (ZN e ZS separado se possível)'

    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken,
        },
        body: JSON.stringify({ phone: TARGET_PHONE, message }),
      }
    )

    const zapiBody = await zapiRes.text()
    console.log('Z-API response', zapiRes.status, zapiBody)

    return new Response(
      JSON.stringify({ ok: true, pendente_id: pendente.id, semana: { inicio, fim }, zapi_status: zapiRes.status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('Erro notify-resumo-semanal-pergunta', e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

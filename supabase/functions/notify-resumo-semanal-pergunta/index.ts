import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'

const TARGET_PHONE = '5581996392285'

function getCurrentWeekRange(now: Date) {
  // Semana domingo a sábado contendo a data atual.
  // Considerando fuso BRT (UTC-3): converter
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const dow = brt.getUTCDay() // 0 = dom, 6 = sab
  const start = new Date(brt)
  start.setUTCDate(brt.getUTCDate() - dow)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
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

    const { inicio, fim } = getCurrentWeekRange(new Date())

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

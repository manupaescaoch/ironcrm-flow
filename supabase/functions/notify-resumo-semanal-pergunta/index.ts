import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0'
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts'
import { buildIdempotencyKey, checkZapiStatus, getZapiCreds, sendTextIdempotent, logEnvio } from '../_shared/zapi.ts'


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
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

  // SECURITY: require cron secret header OR valid Supabase JWT.
  {
    const __auth = await authorizeCronOrJwt(req)
    if (!__auth.ok) {
      return new Response(
        JSON.stringify({ error: __auth.error || 'Unauthorized' }),
        { status: __auth.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
  }


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

    // Enviar pergunta via D-API (operacional)
    const message = 'Qual foi o valor investido em tráfego pago essa semana? (ZN e ZS separado se possível)'

    const creds = getZapiCreds('operacional')
    if (!creds) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp operacional não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // [WhatsApp health] aborta cedo se o chip estiver offline
    {
      const __st = await checkZapiStatus(creds)
      if (!__st.connected) {
        console.warn(`[resumo-semanal-pergunta] ${creds.provider} offline — abortando`, __st.raw)
        return new Response(
          JSON.stringify({ error: 'WhatsApp operacional desconectado', provider: creds.provider, status: __st.raw }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    const chave = buildIdempotencyKey(['notify-resumo-semanal-pergunta', inicio, fim, TARGET_PHONE])
    const sendResult = await sendTextIdempotent(supabase, creds, TARGET_PHONE, message, { chave, funcao: 'notify-resumo-semanal-pergunta' })
    const zapiBody = sendResult.body
    const success = sendResult.ok && !!(zapiBody?.messageId || zapiBody?.id)
    const errorMsg = success
      ? null
      : (zapiBody?.error || JSON.stringify(zapiBody).slice(0, 500))

    await logEnvio(supabase, {
      funcao: 'notify-resumo-semanal-pergunta',
      destino: TARGET_PHONE,
      tipo_destino: 'funcionario',
      sucesso: success,
      erro_msg: errorMsg,
      zapi_status_code: sendResult.status,
      canal: 'operacional',
      resposta_completa: zapiBody,
    })

    console.log(`[resumo-semanal-pergunta] ${creds.provider} response`, sendResult.status, zapiBody)

    return new Response(
      JSON.stringify({ ok: true, pendente_id: pendente.id, semana: { inicio, fim }, provider: creds.provider, status: sendResult.status, success }),
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

// Escrita do EVO OS no Contas a Pagar: confirmar baixa de uma conta.
// Autenticação: header x-evo-token = secret EVO_PAINEL_TOKEN (o mesmo de painel-contas-pagar).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'
import { safeEqual } from '../_shared/telegram.ts'
import { conciliarConta } from '../_shared/conciliacaoBancaria.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const Corpo = z.object({
  id: z.string().uuid(),
  status: z.literal('paga'),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baixado_por_nome: z.string().trim().min(1).max(120),
  valor: z.coerce.number().positive(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, erro: 'método não permitido, use POST' }, 405)

  const secret = Deno.env.get('EVO_PAINEL_TOKEN')
  const token = req.headers.get('x-evo-token')
  if (!token) return json({ ok: false, erro: 'token ausente (header x-evo-token)' }, 401)
  if (!secret || !safeEqual(token, secret)) return json({ ok: false, erro: 'token inválido' }, 401)

  try {
    const p = Corpo.safeParse(await req.json().catch(() => null))
    if (!p.success) return json({ ok: false, erro: 'corpo inválido: envie id, status "paga", data_pagamento (aaaa-mm-dd), baixado_por_nome e valor' }, 400)
    const b = p.data
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: conta, error: e1 } = await supabase.from('contas_pagar')
      .select('id, status, valor, forma_pagamento').eq('id', b.id).is('deleted_at', null).maybeSingle()
    if (e1) throw e1
    if (!conta) return json({ ok: false, erro: 'conta não encontrada' }, 404)
    if (conta.status === 'paga') return json({ ok: true, ja_estava: true })
    if (conta.status !== 'pendente') return json({ ok: false, erro: `conta está ${conta.status} e não pode receber baixa` })
    if (Math.abs(Number(conta.valor) - b.valor) > 0.005) return json({ ok: false, erro: 'valor divergente' })

    const agora = new Date().toISOString()
    const nome = `${b.baixado_por_nome} (EVO OS)`
    const { data: ok, error: e2 } = await supabase.from('contas_pagar').update({
      status: 'paga',
      valor_pago: conta.valor,
      data_pagamento: b.data_pagamento,
      forma_pagamento_baixa: conta.forma_pagamento,
      baixado_por_nome: b.baixado_por_nome,
      baixado_em: agora,
      baixa_origem: 'evo_os',
      conciliacao_status: 'aguardando_transacao',
      updated_at: agora,
    }).eq('id', b.id).eq('status', 'pendente').select('id').maybeSingle()
    if (e2) throw e2
    if (!ok) return json({ ok: true, ja_estava: true })

    await supabase.from('contas_pagar_historico').insert({
      conta_id: b.id, acao: 'baixa_evo_os', campo: 'status', valor_anterior: 'pendente',
      valor_novo: `paga em ${b.data_pagamento} (EVO OS)`, user_nome: nome,
    })
    try { await conciliarConta(supabase, b.id, { notificar: false }) } catch (e) { console.error('[conciliacao]', e) }

    return json({ ok: true })
  } catch (e) {
    console.error('[painel-contas-pagar-baixa]', e)
    return json({ ok: false, erro: 'erro interno ao registrar a baixa' }, 500)
  }
})

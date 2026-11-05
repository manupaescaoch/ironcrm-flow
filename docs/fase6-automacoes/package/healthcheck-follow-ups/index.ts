// Health-check: verifica se a função `send-follow-ups-automaticos` gravou
// pelo menos um registro em `whatsapp_envios_log` no dia útil corrente.
// Se o cron rodou (>= 09:35 BRT) e nenhum log foi gravado enquanto existem
// follow-ups elegíveis pendentes, envia UM alerta WhatsApp ao admin.
//
// Anti-duplicidade:
// - Idempotência por dia: só envia 1 alerta por dia (chave em whatsapp_envios_log
//   com funcao='healthcheck-follow-ups' + motivo_skip='healthcheck_alert_sent').
// - Claim atômico via INSERT com ON CONFLICT — se outra execução tentar em
//   paralelo, apenas a primeira consegue registrar e enviar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authorizeCronOrJwt } from '../_shared/cronAuth.ts';
import { buildIdempotencyKey, checkZapiStatus, getZapiCreds, sendTextIdempotent } from '../_shared/zapi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const FUNC = 'healthcheck-follow-ups';
const TARGET = 'send-follow-ups-automaticos';

function getBrasiliaParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const dateStr = `${v.year}-${v.month}-${v.day}`;
  const brasiliaNoon = new Date(`${dateStr}T12:00:00Z`);
  return {
    dateStr,
    dayOfWeek: brasiliaNoon.getUTCDay(),
    hour: Number(v.hour),
    minute: Number(v.minute),
  };
}

function normalizePhone(phone: string): string {
  let n = (phone || '').replace(/\D/g, '');
  if (!n) return '';
  if (!n.startsWith('55')) n = '55' + n;
  return n;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authorizeCronOrJwt(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ error: auth.error || 'Unauthorized' }),
      { status: auth.status || 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* sem body */ }
    const force = body?.force === true;
    const dryRun = body?.dry_run === true;
    const toleranceMin: number = Number.isFinite(body?.tolerance_minutes) ? body.tolerance_minutes : 35;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { dateStr, dayOfWeek, hour, minute } = getBrasiliaParts();
    const nowMinutes = hour * 60 + minute;
    const cronMinutes = 9 * 60; // 09:00 BRT

    // Fora do horário útil ou fim de semana → nada a checar
    if (!force) {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return new Response(JSON.stringify({ skipped: 'weekend' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (nowMinutes < cronMinutes + toleranceMin) {
        return new Response(JSON.stringify({ skipped: 'antes_da_janela', tolerance_minutes: toleranceMin }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Janela de "hoje" em BRT
    const dayStartIso = `${dateStr}T00:00:00-03:00`;
    const dayEndIso = `${dateStr}T23:59:59-03:00`;

    // 1) Já existe log da função-alvo hoje?
    const { count: logCount, error: logErr } = await supabase
      .from('whatsapp_envios_log')
      .select('id', { count: 'exact', head: true })
      .eq('funcao', TARGET)
      .gte('created_at', dayStartIso)
      .lte('created_at', dayEndIso);

    if (logErr) throw logErr;

    if ((logCount ?? 0) > 0) {
      return new Response(
        JSON.stringify({ ok: true, status: 'healthy', logs_today: logCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2) Existem follow-ups elegíveis? (senão, silêncio é esperado)
    const { count: pendCount, error: pendErr } = await supabase
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .lte('data_prevista', dayEndIso)
      .in('tipo', ['D+1', 'D+7', 'D+15', 'D+30', 'M+7', 'M+30']);

    if (pendErr) throw pendErr;

    if ((pendCount ?? 0) === 0) {
      return new Response(
        JSON.stringify({ ok: true, status: 'sem_pendencias' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2.5) AUTO-RETRY — antes de alertar, tenta reexecutar send-follow-ups-automaticos.
    // Se o retry gravar log, o próximo passo já detecta e nada de alerta é enviado.
    if (!force && !dryRun) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        console.log('[healthcheck-follow-ups] disparando auto-retry de send-follow-ups-automaticos');
        const retryResp = await fetch(`${supabaseUrl}/functions/v1/send-follow-ups-automaticos`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ auto_retry: true }),
        });
        console.log('[healthcheck-follow-ups] auto-retry status', retryResp.status);
        // Aguarda o retry gravar algum log (executa em background)
        await new Promise((r) => setTimeout(r, 5000));

        // Recheca se algum log foi gravado pelo retry
        const { count: logCount2 } = await supabase
          .from('whatsapp_envios_log')
          .select('id', { count: 'exact', head: true })
          .eq('funcao', TARGET)
          .gte('created_at', dayStartIso)
          .lte('created_at', dayEndIso);
        if ((logCount2 ?? 0) > 0) {
          return new Response(
            JSON.stringify({ ok: true, status: 'auto_retry_ok', logs_today: logCount2 }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      } catch (retryErr) {
        console.error('[healthcheck-follow-ups] auto-retry falhou', retryErr);
      }
    }

    // 3) Anti-duplicidade — se já disparamos alerta hoje, não envia de novo
    const { data: alreadySent, error: dupErr } = await supabase
      .from('whatsapp_envios_log')
      .select('id')
      .eq('funcao', FUNC)
      .eq('motivo_skip', 'healthcheck_alert_sent')
      .gte('created_at', dayStartIso)
      .lte('created_at', dayEndIso)
      .limit(1);

    if (dupErr) throw dupErr;
    if (alreadySent && alreadySent.length > 0) {
      return new Response(
        JSON.stringify({ ok: true, status: 'alerta_ja_enviado_hoje', pendentes: pendCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }


    const destinoRaw = Deno.env.get('WHATSAPP_ALERTA_ADMIN') || '';
    const destino = normalizePhone(destinoRaw);
    if (!destino) {
      return new Response(
        JSON.stringify({ error: 'WHATSAPP_ALERTA_ADMIN não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4) Claim atômico — grava o log ANTES de tentar enviar, para bloquear
    // qualquer execução concorrente. Se falhar o envio, atualizamos sucesso=false.
    const claimIso = new Date().toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from('whatsapp_envios_log')
      .insert({
        funcao: FUNC,
        destino,
        tipo_destino: 'admin',
        sucesso: false, // marca como false até confirmar envio
        motivo_skip: 'healthcheck_alert_sent',
        canal: 'operacional',
        created_at: claimIso,
      })
      .select('id')
      .single();

    if (claimErr || !claimed) {
      // Alguém pode ter inserido em paralelo — recheca
      return new Response(
        JSON.stringify({ ok: true, status: 'claim_falhou_provavel_concorrencia', err: claimErr?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (dryRun) {
      // Remove o claim se for dry_run (não queremos bloquear alertas reais)
      await supabase.from('whatsapp_envios_log').delete().eq('id', claimed.id);
      return new Response(
        JSON.stringify({ ok: true, status: 'dry_run', pendentes: pendCount, destino }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 5) Enviar alerta via chip OPERACIONAL (o comercial pode estar offline —
    // que é justamente a causa mais provável desse alerta)
    const creds = getZapiCreds('operacional');
    if (!creds) {
      await supabase
        .from('whatsapp_envios_log')
        .update({ erro_msg: 'ZAPI operacional sem credenciais' })
        .eq('id', claimed.id);
      return new Response(
        JSON.stringify({ error: 'Credenciais Z-API operacional ausentes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const st = await checkZapiStatus(creds);
    if (!st.connected) {
      await supabase
        .from('whatsapp_envios_log')
        .update({ erro_msg: `ZAPI operacional offline: ${JSON.stringify(st.raw).slice(0, 300)}` })
        .eq('id', claimed.id);
      return new Response(
        JSON.stringify({ error: 'Chip operacional offline — não foi possível enviar alerta', zapi: st.raw }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const msg =
      `🚨 *ALERTA — Follow-ups automáticos*\n\n` +
      `A função \`${TARGET}\` NÃO gravou nenhum envio hoje (${dateStr}).\n` +
      `Existem *${pendCount}* follow-up(s) pendente(s) elegíveis para envio.\n\n` +
      `Provável causa: chip comercial (Z-API) offline ou falha na execução do cron.\n\n` +
      `👉 Verifique em /admin/whatsapp-comercial e reconecte o chip se necessário.`;

    const chave = buildIdempotencyKey([FUNC, 'alerta', dateStr, destino]);
    const r = await sendTextIdempotent(supabase, creds, destino, msg, { chave, funcao: FUNC });

    if (r.ok) {
      await supabase
        .from('whatsapp_envios_log')
        .update({ sucesso: true })
        .eq('id', claimed.id);
      return new Response(
        JSON.stringify({ ok: true, status: 'alerta_enviado', pendentes: pendCount, destino }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await supabase
      .from('whatsapp_envios_log')
      .update({ erro_msg: `Falha envio: ${JSON.stringify(r).slice(0, 300)}` })
      .eq('id', claimed.id);

    return new Response(
      JSON.stringify({ error: 'Falha ao enviar alerta', detail: r }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('[healthcheck-follow-ups] erro', e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

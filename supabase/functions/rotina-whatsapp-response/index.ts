import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PayloadSchema = z.object({
  buttonsResponseMessage: z.object({
    selectedButtonId: z.string().max(200).optional(),
    buttonId: z.string().max(200).optional(),
  }).optional(),
  buttonResponseMessage: z.object({
    selectedButtonId: z.string().max(200).optional(),
    buttonId: z.string().max(200).optional(),
  }).optional(),
  phone: z.string().max(40).optional(),
  chatId: z.string().max(80).optional(),
  from: z.string().max(80).optional(),
}).passthrough();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: webhook deve ter secret compartilhado (fail-closed se env ausente).
  const expectedSecret = Deno.env.get('ZAPI_WEBHOOK_SECRET');
  if (!expectedSecret || expectedSecret.length < 16) {
    console.error('[rotina-response] ZAPI_WEBHOOK_SECRET não configurado');
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const providedSecret = req.headers.get('x-webhook-secret') || '';
  if (!providedSecret || !constantTimeEqual(providedSecret, expectedSecret)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawPayload = await req.json();
    const parsed = PayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'invalid payload' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const payload = parsed.data;
    console.log('[rotina-response] Webhook recebido');

    const buttonResponse = payload.buttonsResponseMessage || payload.buttonResponseMessage;

    if (!buttonResponse) {
      console.log('[rotina-response] Não é resposta de botão, ignorando');
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const selectedButtonId = buttonResponse.selectedButtonId || buttonResponse.buttonId || '';
    const senderPhone = normalizePhone(payload.phone || payload.chatId || payload.from || '');

    if (!selectedButtonId || !senderPhone) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'missing data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isFeito = selectedButtonId.startsWith('feito_');
    const isNaoFeito = selectedButtonId.startsWith('naofeito_');

    if (!isFeito && !isNaoFeito) {
      console.log('[rotina-response] Botão não reconhecido');
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'unknown button' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rotinaId = selectedButtonId.replace(/^(feito_|naofeito_)/, '');
    if (!UUID_RE.test(rotinaId)) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid rotina id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const concluida = isFeito;

    const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
    const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
    const ZAPI_CLIENT_TOKEN = Deno.env.get('ZAPI_CLIENT_TOKEN');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Find user by phone number
    // Remove country code prefix for matching (phones stored as e.g. "11999999999" or "5511999999999")
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUsers = authData?.users || [];

    const { data: userProfiles } = await supabase
      .from('user_profiles')
      .select('telefone, user_id')
      .not('telefone', 'is', null)
      .neq('telefone', '');

    // Match phone - normalize both sides
    let matchedUserName = 'Usuário (via WhatsApp)';
    let matchedUserId: string | null = null;

    for (const profile of (userProfiles || [])) {
      const profilePhone = normalizePhone(profile.telefone || '');
      // Match if one ends with the other (handle country code differences)
      if (senderPhone.endsWith(profilePhone) || profilePhone.endsWith(senderPhone) || senderPhone === profilePhone) {
        matchedUserId = profile.user_id;
        const user = authUsers.find(u => u.id === profile.user_id);
        if (user) {
          matchedUserName = user.user_metadata?.full_name || user.user_metadata?.name || 'Usuário (via WhatsApp)';
        }
        break;
      }
    }

    console.log(`[rotina-response] Usuário: ${matchedUserName}, Rotina: ${rotinaId}, Concluída: ${concluida}`);

    // Get rotina info
    const { data: rotina } = await supabase
      .from('rotinas')
      .select('id, nome, unidade_id')
      .eq('id', rotinaId)
      .single();

    if (!rotina) {
      console.error('[rotina-response] Rotina não encontrada:', rotinaId);
      return new Response(JSON.stringify({ ok: false, error: 'Rotina não encontrada' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    // Check if execution already exists for today
    const { data: existing } = await supabase
      .from('rotina_execucoes')
      .select('id')
      .eq('rotina_id', rotinaId)
      .eq('data_execucao', today)
      .is('atividade_id', null)
      .maybeSingle();

    if (existing) {
      // Update existing
      await supabase
        .from('rotina_execucoes')
        .update({
          concluida,
          concluida_por: `${matchedUserName} (via WhatsApp)`,
          concluida_em: concluida ? new Date().toISOString() : null,
        })
        .eq('id', existing.id);
    } else {
      // Insert new
      await supabase
        .from('rotina_execucoes')
        .insert({
          rotina_id: rotinaId,
          atividade_id: null,
          data_execucao: today,
          concluida,
          concluida_por: `${matchedUserName} (via WhatsApp)`,
          concluida_em: concluida ? new Date().toISOString() : null,
          unidade_id: rotina.unidade_id,
        });
    }

    // Send confirmation message via Z-API
    if (ZAPI_INSTANCE_ID && ZAPI_TOKEN) {
      const confirmMessage = concluida
        ? `✅ *Rotina concluída*\n\n🔹 *${rotina.nome}*\n👤 *Registrado por:* ${matchedUserName}\n\nObrigado pela confirmação! 👏`
        : `⚠️ *Rotina não realizada*\n\n🔹 *${rotina.nome}*\n👤 *Registrado por:* ${matchedUserName}\n\nRegistro feito. Caso precise reagendar, fale com a coordenação.`;

      const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

      try {
        await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': ZAPI_CLIENT_TOKEN || '',
          },
          body: JSON.stringify({ phone: senderPhone, message: confirmMessage }),
        });
        console.log('[rotina-response] Confirmação enviada');
      } catch (err) {
        console.error('[rotina-response] Erro ao enviar confirmação:', err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, rotina_id: rotinaId, concluida, user: matchedUserName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[rotina-response] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

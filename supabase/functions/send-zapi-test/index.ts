import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { checkZapiStatus, getZapiCreds, lookupWhatsAppPhone, sendText } from '../_shared/zapi.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { phone, message } = await req.json();
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'phone e message obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const creds = getZapiCreds();
    if (!creds) {
      return new Response(JSON.stringify({ error: 'credenciais Z-API ausentes' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedPhone = (() => {
      const digits = phone.replace(/\D/g, '');
      return digits.startsWith('55') ? digits : `55${digits}`;
    })();

    const [status, lookup] = await Promise.all([
      checkZapiStatus(creds),
      lookupWhatsAppPhone(creds, normalizedPhone),
    ]);

    const sendPhone = lookup.exists && lookup.phone ? lookup.phone : normalizedPhone;
    const result = await sendText(creds, sendPhone, message);
    const messageId = result.body?.messageId || result.body?.id || null;
    const reallyOk = result.ok && !!messageId;

    return new Response(JSON.stringify({
      ok: reallyOk,
      status: result.status,
      sendPhone,
      zapiConnected: status.connected,
      lookup: {
        exists: lookup.exists,
        phone: lookup.phone,
      },
      body: result.body,
      messageId,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

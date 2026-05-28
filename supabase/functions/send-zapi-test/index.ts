import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { phone, message } = await req.json();
    if (!phone || !message) {
      return new Response(JSON.stringify({ error: 'phone e message obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const instance = Deno.env.get('ZAPI_INSTANCE_ID')!;
    const token = Deno.env.get('ZAPI_TOKEN')!;
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')!;
    const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
      body: JSON.stringify({ phone: phone.replace(/\D/g, ''), message }),
    });
    const body = await resp.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, body }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

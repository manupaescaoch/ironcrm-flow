import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkZapiStatus, getZapiCreds, lookupWhatsAppPhone, sendText, logEnvio } from '../_shared/zapi.ts';

const MAX_MESSAGE_LEN = 1000;

function maskPhone(p: string): string {
  const d = p.replace(/\D/g, '');
  if (d.length < 4) return '***';
  return d.slice(0, 4) + '***' + d.slice(-2);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    // 1) Auth — exigir JWT válido
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ error: 'Unauthorized' }, 401);
    }
    const userId = claimsData.claims.sub as string;

    // 2) Role — somente admin pode disparar testes de WhatsApp
    const { data: isAdmin, error: roleErr } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: 'admin',
    });
    if (roleErr || isAdmin !== true) {
      return json({ error: 'Forbidden' }, 403);
    }

    // 3) Payload validation
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const phoneRaw = typeof body?.phone === 'string' ? body.phone : '';
    const message = typeof body?.message === 'string' ? body.message : '';
    if (!phoneRaw || !message) {
      return json({ error: 'phone e message obrigatórios' }, 400);
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return json({ error: `message excede ${MAX_MESSAGE_LEN} caracteres` }, 400);
    }
    const digits = phoneRaw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      return json({ error: 'telefone inválido' }, 400);
    }
    const normalizedPhone = digits.startsWith('55') ? digits : `55${digits}`;

    // Canal de envio (default operacional). Valida estritamente.
    const channelRaw = typeof body?.channel === 'string' ? body.channel : 'operacional';
    if (channelRaw !== 'comercial' && channelRaw !== 'operacional') {
      return json({ error: "channel deve ser 'comercial' ou 'operacional'" }, 400);
    }
    const channel = channelRaw as 'comercial' | 'operacional';

    // 4) Z-API — secrets só do ambiente
    const creds = getZapiCreds(channel);
    if (!creds) {
      return json({ error: `credenciais Z-API ausentes para canal ${channel}` }, 500);
    }

    const [status, lookup] = await Promise.all([
      checkZapiStatus(creds),
      lookupWhatsAppPhone(creds, normalizedPhone),
    ]);

    const sendPhone = lookup.exists && lookup.phone ? lookup.phone : normalizedPhone;
    const result = await sendText(creds, sendPhone, message);
    const messageId = result.body?.messageId || result.body?.id || null;
    const reallyOk = result.ok && !!messageId;

    // 5) Auditoria
    await logEnvio(supabase, {
      funcao: 'send-zapi-test',
      destino: maskPhone(sendPhone),
      tipo_destino: 'interno',
      sucesso: reallyOk,
      erro_msg: reallyOk ? null : (result.body?.error ? String(result.body.error).slice(0, 500) : JSON.stringify(result.body).slice(0, 500)),
      zapi_status_code: result.status,
      canal: channel,
      resposta_completa: result.body,
    });


    return json({
      ok: reallyOk,
      status: result.status,
      zapiConnected: status.connected,
      lookup: { exists: lookup.exists, phone: lookup.phone, raw: lookup.raw },
      sendPhone,
      sendBody: result.body,
      messageId,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

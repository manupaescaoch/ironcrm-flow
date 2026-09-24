// Envia um comunicado para uma lista de grupos do Telegram.
// Chamada interna: header x-cron-secret (public.get_cron_secret()).
// Body: { text: string, chat_ids: (number|string)[], message_type?: string }

import { adminCorsHeaders } from '../_shared/cors.ts';
import { adminClient, sendTelegramMessage } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  const corsHeaders = adminCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const admin = adminClient();
    const { data: cfg } = await admin.from('app_config').select('valor').eq('chave', 'cron_secret').maybeSingle();
    const expected = cfg?.valor ?? '';
    const provided = req.headers.get('x-cron-secret') ?? '';
    if (!expected || provided !== expected) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? '').trim();
    const chatIds: (number | string)[] = Array.isArray(body?.chat_ids) ? body.chat_ids : [];
    if (!text || chatIds.length === 0) return json({ error: 'text e chat_ids obrigatórios' }, 400);

    const results: { chat_id: number | string; ok: boolean; message_id?: number; error?: string }[] = [];
    for (const chatId of chatIds) {
      const r = await sendTelegramMessage({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        recipient_type: 'grupo',
        message_type: body?.message_type ?? 'comunicado',
      }, admin);
      results.push({ chat_id: chatId, ok: r.ok, message_id: r.message_id, error: r.error });
      // pequena pausa para respeitar rate limit do Telegram
      await new Promise((res) => setTimeout(res, 350));
    }

    return json({ ok: results.every((r) => r.ok), results });
  } catch (e) {
    return json({ error: 'erro_interno', details: String(e) }, 500);
  }
});

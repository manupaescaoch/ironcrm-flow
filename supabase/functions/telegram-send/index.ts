// Função reutilizável de envio de mensagens pelo Telegram (usuário ou grupo).
// Aceita chamada de administradores autenticados ou de automações internas via x-internal-secret.

import { adminCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { adminClient, sendTelegramMessage } from '../_shared/telegram.ts';

Deno.serve(async (req) => {
  const corsHeaders = adminCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const admin = adminClient();
    const internalSecret = Deno.env.get('INTERNAL_NOTIFY_SECRET');
    const providedInternal = req.headers.get('x-internal-secret');
    let authorized = !!internalSecret && providedInternal === internalSecret;

    if (!authorized) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
      );
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: 'unauthorized' }, 401);
      const { data: isAdmin } = await admin.rpc('has_role', { _user_id: userData.user.id, _role: 'admin' });
      if (!isAdmin) return json({ error: 'forbidden' }, 403);
      authorized = true;
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? '').trim();
    if (!text) return json({ error: 'text obrigatório' }, 400);

    // Destino: chat_id direto, group_type cadastrado ou user_id do CRM
    let chatId: number | string | null = body?.chat_id ?? null;
    let recipientType: 'usuario' | 'grupo' = 'usuario';
    let recipientId: string | null = null;

    if (!chatId && body?.group_type) {
      const { data: grupo } = await admin.from('telegram_groups')
        .select('telegram_chat_id').eq('group_type', String(body.group_type)).maybeSingle();
      if (!grupo?.telegram_chat_id) return json({ error: 'grupo_nao_conectado' }, 400);
      chatId = grupo.telegram_chat_id;
      recipientType = 'grupo';
    }

    if (!chatId && body?.user_id) {
      const { data: link } = await admin.from('telegram_users')
        .select('telegram_user_id').eq('user_id', String(body.user_id)).maybeSingle();
      if (!link?.telegram_user_id) return json({ error: 'usuario_nao_conectado' }, 400);
      chatId = link.telegram_user_id;
      recipientId = String(body.user_id);
    }

    if (!chatId) return json({ error: 'destino obrigatório (chat_id, group_type ou user_id)' }, 400);

    const result = await sendTelegramMessage({
      chat_id: chatId,
      text,
      parse_mode: body?.parse_mode ?? 'HTML',
      reply_markup: body?.reply_markup,
      recipient_type: recipientType,
      recipient_id: recipientId,
      message_type: body?.message_type ?? 'texto',
    }, admin);

    if (!result.ok) return json({ error: 'falha_envio', details: result.error }, 502);
    return json({ ok: true, message_id: result.message_id });
  } catch (e) {
    console.error('telegram-send error', e);
    return json({ error: 'internal_error', details: e instanceof Error ? e.message : String(e) }, 500);
  }
});
